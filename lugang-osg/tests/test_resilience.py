# 鲁港通 - 采集韧性加固测试（济南三站零成本加固，2026-11-04）
# 覆盖四层：瞬时失败分级（fetcher）/ 退避重试与连续被拒熔断（_fetch_with_retry）/
# 发现层节流 + 来源级 UA 与请求头（sync_source）。全部离线，不发真实网络。
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

import pytest
from sqlalchemy import select

from app.config import Settings
from app.ingest.pipeline import (
    _PACE_JITTER,
    _RETRY_BACKOFF_S,
    _fetch_with_retry,
    sync_source,
)
from app.ingest.yaml_import import import_sources_yaml
from app.models import Source
from app.security.fetcher import (
    FetchAborted,
    FetchBlocked,
    FetchTransient,
    fetch_url,
)
from app.security.url_validator import DomainRule, RejectReason

RULES = (DomainRule(hostname="www.jinan.gov.cn", path_prefix="/"),)

_LONG_ZH = "济南市人民政府办公厅关于进一步促进就业创业的通知要求，各单位遵照执行并做好落实。" * 20

BOT_UA = "LuGangTongOfficialSourceBot/1.0 (test)"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def _settings(**kw) -> Settings:
    """默认 bot 标识，允许调用方逐键覆写（user_agent 等）。"""
    base = dict(api_key_fastgpt="x", user_agent=BOT_UA)
    base.update(kw)
    return Settings(**base)


def _mock_transport(handler):
    import httpx

    return httpx.MockTransport(handler)


def _res(httpx_status: int, headers: dict | None = None, content: bytes = b""):
    import httpx

    return lambda req: httpx.Response(httpx_status, headers=headers or {}, content=content)


class _RecordingFetcher:
    """记录每次调用收到的 settings（来源级 UA/节流覆盖断言用）。"""

    def __init__(self, responses: dict[str, bytes]):
        self.responses = responses
        self.calls: list[str] = []
        self.user_agents: list[str] = []

    def __call__(self, url, rules, settings, method="GET"):
        self.calls.append(url)
        self.user_agents.append(settings.user_agent)
        if url in self.responses:
            from app.security.fetcher import FetchResult

            return FetchResult(final_url=url, http_status=200,
                               content_type="text/html", content=self.responses[url])
        raise ConnectionError(f"no route to {url}")


# ---------------------------------------------------------------------------
# 1) fetcher：瞬时失败与硬拒绝分级（5xx/429 可重试；401/403 绝不重试）
# ---------------------------------------------------------------------------

class TestTransientClassification:

    @pytest.mark.parametrize("status", [500, 502, 503, 504])
    def test_server_errors_are_transient(self, status):
        """鲁港通 - 政务站 WAF/网关抖动实测返 5xx：旧实现归为 FetchAborted，
        一次 502 即整天放弃（济南三站零发现主因）。5xx 必须判为可重试的瞬时失败。"""
        transport = _mock_transport(_res(status, {"content-type": "text/html"}, b"bad gateway"))
        with pytest.raises(FetchTransient) as ei:
            fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                      transport=transport, resolver=lambda h: ("203.198.135.1",))
        assert ei.value.http_status == status
        assert ei.value.retry_after_s is None

    def test_429_with_retry_after_delta_seconds(self):
        transport = _mock_transport(_res(429, {"content-type": "text/html",
                                               "retry-after": "30"}, b"too many"))
        with pytest.raises(FetchTransient) as ei:
            fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                      transport=transport, resolver=lambda h: ("203.198.135.1",))
        assert ei.value.retry_after_s == 30.0

    def test_429_without_retry_after_is_transient_without_hint(self):
        transport = _mock_transport(_res(429, {"content-type": "text/html"}, b"too many"))
        with pytest.raises(FetchTransient) as ei:
            fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                      transport=transport, resolver=lambda h: ("203.198.135.1",))
        assert ei.value.retry_after_s is None

    def test_retry_after_http_date_parsed(self):
        """部分 WAF 的 Retry-After 给 HTTP-date（RFC 7231 两种形态都须认）。"""
        when = datetime.now(timezone.utc) + timedelta(seconds=90)
        transport = _mock_transport(_res(503, {"content-type": "text/html",
                                               "retry-after": format_datetime(when, usegmt=True)},
                                         b"unavailable"))
        with pytest.raises(FetchTransient) as ei:
            fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                      transport=transport, resolver=lambda h: ("203.198.135.1",))
        assert 60.0 <= ei.value.retry_after_s <= 91.0

    def test_retry_after_garbage_ignored(self):
        transport = _mock_transport(_res(503, {"content-type": "text/html",
                                               "retry-after": "later"}, b""))
        with pytest.raises(FetchTransient) as ei:
            fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                      transport=transport, resolver=lambda h: ("203.198.135.1",))
        assert ei.value.retry_after_s is None

    @pytest.mark.parametrize("status", [401, 403])
    def test_auth_and_forbidden_stay_blocked(self, status):
        """鲁港通 - 403 是「不硬闯」信号：必须继续走 FetchBlocked（不重试），
        加固只放宽瞬时失败，不放宽拒绝。"""
        transport = _mock_transport(_res(status, {"content-type": "text/html"}, b"denied"))
        with pytest.raises(FetchBlocked):
            fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                      transport=transport, resolver=lambda h: ("203.198.135.1",))

    def test_source_extra_headers_and_ua_sent(self):
        """来源级请求头覆写须真正出现在报文里（拟真节奏的前提）。"""
        seen: dict = {}

        def handler(request):
            seen["ua"] = request.headers.get("user-agent")
            seen["lang"] = request.headers.get("accept-language")
            from httpx import Response
            return Response(200, headers={"content-type": "text/html"}, content=b"ok")

        settings = _settings(user_agent=BROWSER_UA,
                             extra_headers={"Accept-Language": "zh-CN,zh;q=0.9"})
        fetch_url("https://www.jinan.gov.cn/x", RULES, settings,
                  transport=_mock_transport(handler),
                  resolver=lambda h: ("203.198.135.1",))
        assert seen["ua"] == BROWSER_UA
        assert seen["lang"] == "zh-CN,zh;q=0.9"

    def test_default_headers_sent_when_not_overridden(self):
        seen: dict = {}

        def handler(request):
            seen["ua"] = request.headers.get("user-agent")
            seen["lang"] = request.headers.get("accept-language")
            from httpx import Response
            return Response(200, headers={"content-type": "text/html"}, content=b"ok")

        fetch_url("https://www.jinan.gov.cn/x", RULES, _settings(),
                  transport=_mock_transport(handler),
                  resolver=lambda h: ("203.198.135.1",))
        assert seen["ua"] == BOT_UA
        assert seen["lang"] is None


# ---------------------------------------------------------------------------
# 2) _fetch_with_retry：退避重试 / 尊重 Retry-After / 熔断计数
# ---------------------------------------------------------------------------

class _RaisingFetcher:
    def __init__(self, *errors):
        self.errors = list(errors)
        self.calls = 0

    def __call__(self, url, rules, settings, method="GET"):
        self.calls += 1
        err = self.errors.pop(0) if self.errors else None
        if err is not None:
            raise err
        from app.security.fetcher import FetchResult

        return FetchResult(final_url=url, http_status=200,
                           content_type="text/html", content=b"ok")


class _Stats:
    """鲁港通 - _fetch_with_retry 真实写入的最小统计面（与 SyncStats 同名字段）。"""

    def __init__(self):
        self.errors: list[str] = []
        self.blocked = 0
        self.consecutive_blocked = 0


class TestFetchWithRetry:

    def _retry(self, fetcher, sleeps, settings=None):
        from app.ingest.pipeline import _fetch_with_retry as f

        return f("https://www.jinan.gov.cn/x", RULES, settings or _settings(),
                 fetcher, sleeps.append, _Stats())

    def test_transient_then_success_retries_with_backoff(self):
        sleeps: list[float] = []
        fetcher = _RaisingFetcher(FetchTransient(503, "u"), FetchTransient(502, "u"))
        result = self._retry(fetcher, sleeps)
        assert result is not None
        assert fetcher.calls == 3                      # 首次 + 2 次重试
        assert sleeps == list(_RETRY_BACKOFF_S[:2])

    def test_transient_exhausts_then_gives_up(self):
        sleeps: list[float] = []
        fetcher = _RaisingFetcher(*[FetchTransient(503, "u")] * 9)
        assert self._retry(fetcher, sleeps) is None
        assert fetcher.calls == len(_RETRY_BACKOFF_S) + 1

    def test_retry_after_overrides_short_backoff(self):
        """服务端明确要我们等 40s → 等 40s，不用自己的 5s。"""
        sleeps: list[float] = []
        fetcher = _RaisingFetcher(FetchTransient(429, "u", retry_after_s=40.0))
        self._retry(fetcher, sleeps)
        assert sleeps[0] == 40.0

    def test_retry_after_beyond_cap_stops_retrying(self):
        """要我们等 2 小时：不能真睡（全程占着全局同步锁），本轮立即放弃。"""
        sleeps: list[float] = []
        fetcher = _RaisingFetcher(FetchTransient(429, "u", retry_after_s=7200.0))
        settings = _settings(transient_retry_max_wait_s=120.0)
        assert self._retry(fetcher, sleeps, settings) is None
        assert fetcher.calls == 1
        assert sleeps == []

    def test_blocked_not_retried_and_counted(self):
        sleeps: list[float] = []
        fetcher = _RaisingFetcher(FetchBlocked(403, "u"))
        stats = _Stats()
        from app.ingest.pipeline import _fetch_with_retry as f

        assert f("https://www.jinan.gov.cn/x", RULES, _settings(),
                 fetcher, sleeps.append, stats) is None
        assert fetcher.calls == 1
        assert sleeps == []
        assert stats.blocked == 1
        assert stats.consecutive_blocked == 1

    def test_consecutive_counter_resets_on_success(self):
        stats = _Stats()
        stats.consecutive_blocked = 2
        from app.ingest.pipeline import _fetch_with_retry as f

        assert f("https://www.jinan.gov.cn/x", RULES, _settings(),
                 _RaisingFetcher(), [].append, stats) is not None
        assert stats.consecutive_blocked == 0


# ---------------------------------------------------------------------------
# 3) sync_source：来源级 UA/节流 + 发现层随机停顿 + 连续被拒熔断
# ---------------------------------------------------------------------------

JINAN_UA_YAML = """
sources:
  - id: jinan_hardened
    name: 济南市系（加固）
    group: sd_core_gov
    organization: 济南市人民政府
    base_domains: [www.jinan.gov.cn]
    allowed_path_prefixes: [/api-gateway/, /channel/]
    discovery_method: api_json
    api_config:
      method: POST
      endpoints:
        - "https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/do-search?pageSize=2&pageNo={pageNo}"
      paginate: {page_param: pageNo, start: 1, max_pages: 5}
      parse:
        rows_path: data.bean.results
        id_field: infoid
        title_field: title
        url_template: "https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/detail?iid={id}"
    content_selector: ".main_content"
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    extra_headers:
      Accept-Language: "zh-CN,zh;q=0.9"
    discovery_min_interval_s: 6
    max_pages_per_run: 10
    enabled: true
  - id: hk_plain
    name: 未加固来源
    group: hk_core_gov
    base_domains: [www.news.gov.hk]
    allowed_path_prefixes: [/]
    discovery_method: fixed_url
    fixed_urls:
      - https://www.news.gov.hk/zh/2026/09/detail.html
    enabled: true
"""

_DOSEARCH = ("https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/"
             "front/info/do-search?pageSize=2&pageNo=")
_DETAIL = ("https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/"
           "front/info/detail?iid=")


def _page(rows) -> bytes:
    return json.dumps({
        "success": True, "code": "200",
        "data": {"infoCount": 4, "bean": {"results": [
            {"infoid": iid, "title": t, "publishdate": "2026-09-09"} for iid, t in rows]}},
    }, ensure_ascii=False).encode("utf-8")


def _empty_page() -> bytes:
    return json.dumps({"success": True, "code": "200",
                       "data": {"infoCount": 0, "bean": {"results": []}}},
                      ensure_ascii=False).encode("utf-8")


def _article(title: str) -> bytes:
    return (f'<html><head><title>{title}</title></head><body>'
            f'<div class="main_content"><p>{_LONG_ZH}</p></div></body></html>').encode("utf-8")


def _mk(**kw) -> Settings:
    """鲁港通 - 默认关闭节流（既有 pipeline 测试同口径），节流行为单独测试显式打开。"""
    base = dict(api_key_fastgpt="x", source_min_interval_s=0,
                discovery_min_interval_s=0, user_agent=BOT_UA)
    base.update(kw)
    return Settings(**base)


class TestSourceScopedPoliteness:

    def _source(self, db, code):
        import_sources_yaml(JINAN_UA_YAML, db)
        return db.execute(select(Source).where(Source.code == code)).scalar_one()

    def test_new_keys_survive_yaml_whitelist(self, db):
        """鲁港通 - 回归护栏：新增来源配置字段必须登记 _DISCOVERY_KEYS，
        否则 YAML 写了也进不了 discovery_config（历史上踩过两次）。"""
        src = self._source(db, "jinan_hardened")
        cfg = src.discovery_config
        assert cfg["user_agent"] == BROWSER_UA
        assert cfg["extra_headers"] == {"Accept-Language": "zh-CN,zh;q=0.9"}
        assert cfg["discovery_min_interval_s"] == 6

    def test_source_ua_and_headers_reach_every_request(self, db):
        src = self._source(db, "jinan_hardened")
        fetcher = _RecordingFetcher({
            _DOSEARCH + "1": _page([("a1", "济南市关于印发A的通知"), ("a2", "济南市关于印发B的通知")]),
            _DOSEARCH + "2": _empty_page(),
            _DETAIL + "a1": _article("A"),
            _DETAIL + "a2": _article("B"),
        })
        sync_source(db, src, settings=_mk(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=lambda h: ("203.198.135.1",))
        assert fetcher.calls
        assert set(fetcher.user_agents) == {BROWSER_UA}

    def test_other_sources_keep_default_bot_ua(self, db):
        """鲁港通 - 加固按来源生效：未声明 user_agent 的来源仍用自报家门的官方bot 标识。"""
        src = self._source(db, "hk_plain")
        fetcher = _RecordingFetcher({
            "https://www.news.gov.hk/zh/2026/09/detail.html": _article("H"),
        })
        sync_source(db, src, settings=_mk(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=lambda h: ("203.198.135.1",))
        assert set(fetcher.user_agents) == {BOT_UA}

    def test_discovery_pages_are_paced_with_jitter(self, db):
        """鲁港通 - 发现层节流：旧实现翻页零间隔，jinan_gov 一轮 49 页连发踩 WAF CC。
        页与页之间须按真人浏览速度随机停顿（base × _PACE_JITTER）。"""
        src = self._source(db, "jinan_hardened")
        fetcher = _RecordingFetcher({
            _DOSEARCH + "1": _page([("a1", "济南市关于印发A的通知")]),
            _DOSEARCH + "2": _page([("a2", "济南市关于印发B的通知")]),
            _DOSEARCH + "3": _page([("a3", "济南市关于印发C的通知")]),
            _DOSEARCH + "4": _empty_page(),
            _DETAIL + "a1": _article("A"),
            _DETAIL + "a2": _article("B"),
            _DETAIL + "a3": _article("C"),
        })
        sleeps: list[float] = []
        sync_source(db, src, settings=_mk(discovery_min_interval_s=6), fetcher=fetcher,
                    sleeper=sleeps.append, resolver=lambda h: ("203.198.135.1",))
        lo, hi = 6 * _PACE_JITTER[0], 6 * _PACE_JITTER[1]
        page_pauses = [s for s in sleeps if lo <= s <= hi]
        assert len(page_pauses) == 3                 # 4 页 → 页间隔 3 次
        assert len(sleeps) == 6                      # 另 3 次是详情间隔（source_min_interval_s=0）
        assert len(set(page_pauses)) > 1             # 随机抖动，不是固定值


class TestBlockedCircuitBreaker:

    def _src_many_candidates(self, db):
        import_sources_yaml(JINAN_UA_YAML, db)
        return db.execute(select(Source).where(Source.code == "jinan_hardened")).scalar_one()

    def test_run_aborts_after_three_consecutive_blocks(self, db):
        """鲁港通 - 连续被拒即退避：旧实现对每个候选继续硬闯（一轮最多
        max_pages_per_run 次 403），正是被拉黑整天的成因。"""
        src = self._src_many_candidates(db)

        class _Blocked:
            def __init__(self):
                self.calls = 0

            def __call__(self, url, rules, settings, method="GET"):
                self.calls += 1
                if "do-search" in url:
                    from app.security.fetcher import FetchResult

                    return FetchResult(final_url=url, http_status=200,
                                       content_type="application/json",
                                       content=_page([
                                           (f"c{i}", f"济南市关于印发通知{i}号") for i in range(6)
                                       ]) if url.endswith("1") else _empty_page())
                raise FetchBlocked(403, url)

        fetcher = _Blocked()
        stats = sync_source(db, src, settings=_mk(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=lambda h: ("203.198.135.1",))
        assert stats.fetch_failed == 3               # 只撞 3 次即停
        assert stats.skipped_after_block == 3        # 剩余 3 条候选本轮不再打扰
        assert "连续被拒" in "; ".join(stats.errors)
