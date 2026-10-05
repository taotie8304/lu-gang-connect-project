# 鲁港通 - 调度器测试（2026-10-03）：同刻多源排队等待而非跳过（cron 扎堆饿死修复）；
# 每日自动导入 job 的源过滤（高校源暂缓 / 未配置路由跳过）。
import threading
import time
from types import SimpleNamespace

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


def _patch_sync_env(monkeypatch, src, ran, lock=None):
    monkeypatch.setattr(
        "app.database.SessionLocal", lambda: _FakeSession(src=src)
    )
    monkeypatch.setattr(
        "app.ingest.pipeline.sync_source",
        lambda session, source: ran.append(source.code),
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
    assert elapsed >= 0.2
    lock.release()


def test_sync_job_skips_disabled_source(monkeypatch):
    """源被禁用时不执行同步（排队拿到锁后二次确认）。"""
    ran = []
    _patch_sync_env(
        monkeypatch, SimpleNamespace(code="hk_gia_press", enabled=False), ran
    )
    scheduler_mod._make_job("hk_gia_press")()
    assert ran == []


def _patch_import_env(monkeypatch, sources, calls):
    monkeypatch.setattr(
        "app.config.get_settings",
        lambda: SimpleNamespace(
            fastgpt_api_key="k",
            fastgpt_base_url="http://127.0.0.1:3210",
            fastgpt_interval_s=0.0,
            fastgpt_chunk_size=512,
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
