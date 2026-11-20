# 鲁港通 - 调度器测试（2026-10-03）：同刻多源排队等待而非跳过（cron 扎堆饿死修复）；
# 每日自动导入 job 的源过滤（高校源暂缓 / 未配置路由跳过）。
import threading
import time
from types import SimpleNamespace

import pytest

import app.scheduler as scheduler_mod


class _FakeResult:
    def __init__(self, src=None, items=None):
        self._src = src
        self._items = items or []

    def scalar_one_or_none(self):
        return self._src

    def scalars(self):
        return self

    def all(self):
        return self._items


class _FakeSession:
    def __init__(self, src=None, sources=None):
        self._src = src
        self._sources = sources or []
        self.closed = False

    def execute(self, *args, **kwargs):
        return _FakeResult(self._src, self._sources)

    def close(self):
        self.closed = True


def _patch_sync_env(monkeypatch, src, ran, lock=None, import_after_sync=False):
    monkeypatch.setattr(
        "app.database.SessionLocal", lambda: _FakeSession(src=src)
    )
    monkeypatch.setattr(
        "app.ingest.pipeline.sync_source",
        lambda session, source: ran.append(source.code),
    )
    monkeypatch.setattr(
        "app.config.get_settings",
        lambda: SimpleNamespace(
            fastgpt_import_after_sync=import_after_sync,
            fastgpt_api_key="test-key" if import_after_sync else "",
            fastgpt_base_url="http://127.0.0.1:3210",
            fastgpt_interval_s=0.0,
            fastgpt_chunk_size=512,
            pdf_store_dir="data/pdfs",
        ),
    )
    if lock is not None:
        monkeypatch.setattr("app.api.admin._sync_lock", lock)


def test_sync_job_queues_until_lock_released(monkeypatch):
    """锁被占时排队等待；锁释放后继续执行（旧行为会直接跳过）。"""
    ran = []
    lock = threading.Lock()
    lock.acquire()  # 模拟前一个同步正在跑
    _patch_sync_env(
        monkeypatch, SimpleNamespace(code="hk_edb", enabled=True), ran, lock
    )

    job = scheduler_mod._make_job("hk_edb")
    t = threading.Thread(target=job)
    t.start()
    time.sleep(0.15)
    assert ran == []  # 等待中：未跳过也未执行
    lock.release()
    t.join(timeout=3)
    assert ran == ["hk_edb"]  # 锁释放后执行
    assert not lock.locked()  # 执行完释放锁


def test_sync_job_times_out_when_lock_held(monkeypatch):
    """等待超过上限时放弃本轮（不再永久阻塞）。"""
    ran = []
    lock = threading.Lock()
    lock.acquire()
    _patch_sync_env(
        monkeypatch, SimpleNamespace(code="sd_gxt", enabled=True), ran, lock
    )
    monkeypatch.setattr(scheduler_mod, "_SYNC_WAIT_TIMEOUT_S", 0.2)

    t0 = time.monotonic()
    scheduler_mod._make_job("sd_gxt")()
    elapsed = time.monotonic() - t0
    assert ran == []
    # 鲁港通 - 锁等待用 timeout=0.2，实际返回可能略早于墙钟（边界抖动），断言留余量
    assert elapsed >= 0.15
    lock.release()


def test_sync_job_skips_disabled_source(monkeypatch):
    """源被禁用时不执行同步（排队拿到锁后二次确认）。"""
    ran = []
    _patch_sync_env(
        monkeypatch, SimpleNamespace(code="hk_gia_press", enabled=False), ran
    )
    scheduler_mod._make_job("hk_gia_press")()
    assert ran == []


def test_trigger_sync_allow_disabled_flag(monkeypatch):
    """管理员强制触发：停用源带 allow_disabled=true 可试采；不带则 409。"""
    from fastapi import BackgroundTasks, HTTPException

    import app.api.admin as admin_mod

    class _FakeDB:
        def execute(self, *args, **kwargs):
            return _FakeResult(SimpleNamespace(code="jinan_huaiyin", enabled=False))

    monkeypatch.setattr(admin_mod, "_sync_lock", threading.Lock())

    resp = admin_mod.trigger_sync(
        "jinan_huaiyin", BackgroundTasks(), force=False,
        allow_disabled=True, actor="test", db=_FakeDB(),
    )
    assert resp.started is True

    with pytest.raises(HTTPException) as ei:
        admin_mod.trigger_sync(
            "jinan_huaiyin", BackgroundTasks(), force=False,
            allow_disabled=False, actor="test", db=_FakeDB(),
        )
    assert ei.value.status_code == 409


# --- P0-2 采集完成后即时导入（事件触发，日报仍作兜底） ---


def test_sync_job_imports_source_after_sync(monkeypatch):
    """采集完成后对本来源立即执行增量导入（已配置路由的源）。"""
    ran, imports = [], []
    _patch_sync_env(
        monkeypatch,
        SimpleNamespace(code="hk_edb", enabled=True),
        ran,
        import_after_sync=True,
    )
    monkeypatch.setattr(
        "app.fastgpt.client.FastGPTClient",
        lambda base_url, key: SimpleNamespace(close=lambda: None),
    )
    monkeypatch.setattr(
        "app.fastgpt.importer.run_import",
        lambda session, client, code, **kw: (
            imports.append(code) or SimpleNamespace(summary_line=lambda: "ok")
        ),
    )

    scheduler_mod._make_job("hk_edb")()

    assert ran == ["hk_edb"]
    assert imports == ["hk_edb"]


def test_sync_job_skips_import_for_deferred_source(monkeypatch):
    """高校暂缓源（未配路由）采集后不触发导入。"""
    ran, imports = [], []
    _patch_sync_env(
        monkeypatch,
        SimpleNamespace(code="sd_sdu", enabled=True),
        ran,
        import_after_sync=True,
    )
    monkeypatch.setattr(
        "app.fastgpt.importer.run_import",
        lambda *args, **kwargs: imports.append(args),
    )

    scheduler_mod._make_job("sd_sdu")()

    assert ran == ["sd_sdu"]
    assert imports == []


def test_sync_job_skips_import_when_disabled(monkeypatch):
    """OSG_IMPORT_AFTER_SYNC 关闭时仅采集不导入（依赖每日批量导入）。"""
    ran, imports = [], []
    _patch_sync_env(
        monkeypatch,
        SimpleNamespace(code="hk_edb", enabled=True),
        ran,
        import_after_sync=False,
    )
    monkeypatch.setattr(
        "app.fastgpt.importer.run_import",
        lambda *args, **kwargs: imports.append(args),
    )

    scheduler_mod._make_job("hk_edb")()

    assert ran == ["hk_edb"]
    assert imports == []


def _patch_import_env(monkeypatch, sources, calls):
    monkeypatch.setattr(
        "app.config.get_settings",
        lambda: SimpleNamespace(
            fastgpt_api_key="k",
            fastgpt_base_url="http://127.0.0.1:3210",
            fastgpt_interval_s=0.0,
            fastgpt_chunk_size=512,
            pdf_store_dir="data/pdfs",
        ),
    )
    monkeypatch.setattr(
        "app.database.SessionLocal", lambda: _FakeSession(sources=sources)
    )
    monkeypatch.setattr(
        "app.fastgpt.client.FastGPTClient",
        lambda base_url, key: SimpleNamespace(close=lambda: None),
    )
    monkeypatch.setattr(
        "app.fastgpt.importer.run_import",
        lambda session, client, code, **kw: (
            calls.append(code) or SimpleNamespace(summary_line=lambda: "ok")
        ),
    )


def test_import_job_covers_routable_sources_only(monkeypatch):
    """每日导入：仅对已配置路由的启用源执行；高校暂缓源与未知源跳过。"""
    calls = []
    sources = [
        SimpleNamespace(code="hk_edb", enabled=True),
        SimpleNamespace(code="sd_gxt", enabled=True),
        SimpleNamespace(code="sd_sdu", enabled=True),  # 高校源暂缓导入
        SimpleNamespace(code="no_such_source", enabled=True),  # 未配置路由
    ]
    _patch_import_env(monkeypatch, sources, calls)

    scheduler_mod._make_import_job()()
    assert calls == ["hk_edb", "sd_gxt"]


def test_import_job_skips_without_api_key(monkeypatch):
    """未配置 FastGPT 密钥时不构造客户端、不执行任何导入。"""
    built = []
    monkeypatch.setattr(
        "app.config.get_settings", lambda: SimpleNamespace(fastgpt_api_key="")
    )
    monkeypatch.setattr(
        "app.fastgpt.client.FastGPTClient", lambda base_url, key: built.append(1)
    )
    scheduler_mod._make_import_job()()
    assert built == []


def test_fail_stale_runs_marks_interrupted(db):
    """进程重启遗留的 running 记录应标 failed，已完成记录不受影响。"""
    from app.models import CrawlRun, Source
    from app.scheduler import fail_stale_runs

    src = Source(
        code="sd_gxt",
        name="山东省工业和信息化厅",
        source_group="shandong",
        discovery_method="listing",
    )
    db.add(src)
    db.commit()
    stale = CrawlRun(source_id=src.id, status="running")
    done = CrawlRun(source_id=src.id, status="finished")
    db.add_all([stale, done])
    db.commit()

    assert fail_stale_runs(db) == 1
    db.refresh(stale)
    db.refresh(done)
    assert stale.status == "failed"
    assert stale.finished_at is not None
    assert "interrupted" in (stale.error_summary or "")
    assert done.status == "finished"
    assert done.finished_at is None
