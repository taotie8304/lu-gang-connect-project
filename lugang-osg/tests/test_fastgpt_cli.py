# 鲁港通 - FastGPT 导入器 CLI 测试：monkeypatch 依赖，验证护栏/参数传递/退出码（不发网络）
from app.fastgpt import cli as cli_mod
from app.fastgpt.importer import ImporterError, ImportReport, NameSyncReport


class FakeSettings:
    fastgpt_base_url = "http://127.0.0.1:3210"
    fastgpt_api_key = "test-key"
    fastgpt_chunk_size = 512
    fastgpt_interval_s = 0.3


class FakeClient:
    def __init__(self, *args, **kwargs):
        self.init_args = (args, kwargs)
        self.closed = False

    def close(self):
        self.closed = True


class FakeSession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def patch_env(
    monkeypatch,
    settings=None,
    captured=None,
    report=None,
    error=None,
    sync_captured=None,
    sync_report=None,
):
    """公共打桩：settings / client / session / run_import / sync_names。"""
    monkeypatch.setattr(cli_mod, "get_settings", lambda: settings or FakeSettings())

    holder = {}

    def client_factory(*args, **kwargs):
        holder["client"] = FakeClient(*args, **kwargs)
        return holder["client"]

    monkeypatch.setattr(cli_mod, "FastGPTClient", client_factory)
    monkeypatch.setattr(cli_mod, "SessionLocal", lambda: FakeSession())

    def fake_run_import(db, client, source, **kwargs):
        if captured is not None:
            captured["source"] = source
            captured.update(kwargs)
        if error is not None:
            raise error
        return report or ImportReport(source_code=source)

    monkeypatch.setattr(cli_mod, "run_import", fake_run_import)

    def fake_sync_names(db, client, source, **kwargs):
        if sync_captured is not None:
            sync_captured["source"] = source
            sync_captured.update(kwargs)
        return sync_report or NameSyncReport(source_code=source)

    monkeypatch.setattr(cli_mod, "sync_names", fake_sync_names)
    return holder


def test_missing_api_key_returns_2(monkeypatch, capsys):
    settings = FakeSettings()
    settings.fastgpt_api_key = ""
    patch_env(monkeypatch, settings=settings)

    code = cli_mod.main(["--source", "hk_tid"])

    assert code == 2
    assert "OSG_FASTGPT_API_KEY" in capsys.readouterr().out


def test_importer_error_returns_2(monkeypatch, capsys):
    patch_env(monkeypatch, error=ImporterError("源不存在：zzz"))

    code = cli_mod.main(["--source", "zzz"])

    assert code == 2
    assert "源不存在" in capsys.readouterr().out


def test_success_passes_options_and_prints_report(monkeypatch, capsys):
    captured = {}
    report = ImportReport(source_code="hk_tid", total=2, imported=2)
    holder = patch_env(monkeypatch, captured=captured, report=report)

    code = cli_mod.main(["--source", "hk_tid", "--dry-run", "--limit", "2"])

    assert code == 0
    assert captured["source"] == "hk_tid"
    assert captured["dry_run"] is True
    assert captured["limit"] == 2
    assert captured["interval"] == 0.3  # 未指定 --interval → 取配置
    assert captured["chunk_size"] == 512
    assert captured["rebuild"] is False
    assert holder["client"].init_args[0] == (
        "http://127.0.0.1:3210",
        "test-key",
    )
    assert holder["client"].closed is True
    out = capsys.readouterr().out
    assert "[hk_tid]" in out
    assert "dry-run 预演" in out


def test_failed_items_return_1(monkeypatch, capsys):
    report = ImportReport(source_code="hk_tid", total=1, failed=1)
    report.errors.append("某文：连接失败")
    patch_env(monkeypatch, report=report)

    code = cli_mod.main(["--source", "hk_tid"])

    assert code == 1
    assert "某文：连接失败" in capsys.readouterr().out


def test_cli_interval_override(monkeypatch):
    captured = {}
    patch_env(monkeypatch, captured=captured, report=ImportReport(source_code="hk_tid"))

    cli_mod.main(["--source", "hk_tid", "--interval", "0"])

    assert captured["interval"] == 0


def test_rebuild_flag_passes_option(monkeypatch):
    captured = {}
    patch_env(monkeypatch, captured=captured, report=ImportReport(source_code="hk_tid"))

    cli_mod.main(["--source", "hk_tid", "--rebuild"])

    assert captured["rebuild"] is True


# --- 名称同步模式（--sync-names） ---


def test_sync_names_mode_calls_sync_and_prints(monkeypatch, capsys):
    captured = {}
    report = NameSyncReport(source_code="hk_tid", checked=5, fixed=2)
    patch_env(monkeypatch, sync_captured=captured, sync_report=report)

    code = cli_mod.main(["--source", "hk_tid", "--sync-names"])

    assert code == 0
    assert captured["source"] == "hk_tid"
    assert captured["dry_run"] is False
    assert captured["interval"] == 0.3
    out = capsys.readouterr().out
    assert "名称同步" in out
    assert "修正 2" in out


def test_sync_names_with_issues_returns_1(monkeypatch, capsys):
    report = NameSyncReport(source_code="hk_tid", checked=3, missing=1)
    report.errors.append("某文：集合缺失")
    patch_env(monkeypatch, sync_report=report)

    code = cli_mod.main(["--source", "hk_tid", "--sync-names"])

    assert code == 1
    assert "某文：集合缺失" in capsys.readouterr().out


def test_sync_names_dry_run_flag(monkeypatch, capsys):
    captured = {}
    patch_env(
        monkeypatch,
        sync_captured=captured,
        sync_report=NameSyncReport(source_code="hk_tid"),
    )

    cli_mod.main(["--source", "hk_tid", "--sync-names", "--dry-run"])

    assert captured["dry_run"] is True
    assert "dry-run 预演" in capsys.readouterr().out
