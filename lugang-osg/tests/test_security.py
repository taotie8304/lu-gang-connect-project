# 鲁港通 - OSG Phase 1 安全测试（spec 16.1 十项验收用例）
# 全部使用注入的假 resolver / 假 transport，不发起真实网络请求。
from __future__ import annotations

import pytest

from app.config import Settings
from app.security.fetcher import FetchAborted, FetchBlocked, fetch_url
from app.security.url_validator import (
    DomainRule,
    RejectReason,
    URLRejected,
    validate_redirect_target,
    validate_target_url,
)

# 鲁港通 - 测试用白名单：模拟一个 https-only 香港站 + 一个 allow_http 山东站
RULES = (
    DomainRule(hostname="www.news.gov.hk", path_prefix="/"),
    DomainRule(
        hostname="commerce.shandong.gov.cn",
        path_prefix="/",
        allow_http=True,
    ),
    DomainRule(hostname="gov.hk", allow_subdomains=True, path_prefix="/"),
)

FAKE_IPS = {"www.news.gov.hk": ("203.198.135.1",)}


def fake_resolver(hostname: str) -> tuple[str, ...]:
    # 鲁港通 - 默认返回公网 IP（203.0.113.x 是文档保留网段，会被 ipaddress 判为 private）
    return FAKE_IPS.get(hostname, ("203.198.135.1",))


class TestURLValidator:
    """spec 16.1 用例 1-8：URL 校验与 SSRF 防护。"""

    def test_case1_allowlist_https_ok(self):
        """用例 1：白名单内 https URL 通过。"""
        v = validate_target_url("https://www.news.gov.hk/en/common/html/topstories.rss.xml", RULES, resolver=fake_resolver)
        assert v.hostname == "www.news.gov.hk"

    def test_case2_private_ip_rejected(self):
        """用例 2：解析到内网 IP（10.x）必须拒绝。"""
        with pytest.raises(URLRejected) as ei:
            validate_target_url(
                "https://www.news.gov.hk/x",
                RULES,
                resolver=lambda h: ("10.0.0.5",),
            )
        assert ei.value.reason is RejectReason.PRIVATE_IP

    def test_case3_loopback_rejected(self):
        """用例 3：localhost / 127.0.0.1 拒绝（含解析到 127.x 的白名单域名）。"""
        with pytest.raises(URLRejected):
            validate_target_url("http://localhost/", RULES, resolver=fake_resolver)
        with pytest.raises(URLRejected) as ei:
            validate_target_url(
                "https://www.news.gov.hk/x",
                RULES,
                resolver=lambda h: ("127.0.0.1",),
            )
        assert ei.value.reason is RejectReason.PRIVATE_IP

    def test_case4_metadata_ip_rejected(self):
        """用例 4：云 metadata 地址（169.254.169.254）拒绝。"""
        with pytest.raises(URLRejected) as ei:
            validate_target_url(
                "https://www.news.gov.hk/x",
                RULES,
                resolver=lambda h: ("169.254.169.254",),
            )
        assert ei.value.reason is RejectReason.PRIVATE_IP

    def test_case5_not_in_allowlist_rejected(self):
        """用例 5：非白名单域名拒绝（含后缀伪造 gov.hk.evil.example）。"""
        with pytest.raises(URLRejected) as ei:
            validate_target_url("https://evil.example.com/x", RULES, resolver=fake_resolver)
        assert ei.value.reason is RejectReason.NOT_IN_ALLOWLIST
        with pytest.raises(URLRejected):
            validate_target_url(
                "https://gov.hk.evil.example/x", RULES, resolver=fake_resolver
            )

    def test_case6_http_only_when_allowed(self):
        """用例 6：http 协议仅 allow_http 来源放行，其余拒绝。"""
        # 山东来源 allow_http=True：http 放行
        v = validate_target_url("http://commerce.shandong.gov.cn/", RULES, resolver=fake_resolver)
        assert v.scheme == "http"
        # 香港来源未放行 http：拒绝
        with pytest.raises(URLRejected) as ei:
            validate_target_url("http://www.news.gov.hk/x", RULES, resolver=fake_resolver)
        assert ei.value.reason is RejectReason.NOT_IN_ALLOWLIST

    def test_case7_redirect_out_of_allowlist_rejected(self):
        """用例 7：重定向跳出白名单必须拒绝。"""
        with pytest.raises(URLRejected) as ei:
            validate_redirect_target(
                "https://attacker.example.com/steal",
                "https://www.news.gov.hk/x",
                RULES,
                resolver=fake_resolver,
            )
        assert ei.value.reason is RejectReason.NOT_IN_ALLOWLIST

    def test_case8_redirect_to_private_rejected(self):
        """用例 8：重定向到内网 IP 必须拒绝。"""
        with pytest.raises(URLRejected) as ei:
            validate_redirect_target(
                "https://www.news.gov.hk/redirect",
                "https://www.news.gov.hk/x",
                RULES,
                resolver=lambda h: ("192.168.1.1",),
            )
        assert ei.value.reason is RejectReason.PRIVATE_IP

    def test_extra_userinfo_rejected(self):
        """补充：URL 内嵌 userinfo 拒绝。"""
        with pytest.raises(URLRejected) as ei:
            validate_target_url(
                "https://user:pass@www.news.gov.hk/x", RULES, resolver=fake_resolver
            )
        assert ei.value.reason is RejectReason.USERINFO_IN_URL

    def test_extra_bad_port_rejected(self):
        """补充：非默认端口拒绝。"""
        with pytest.raises(URLRejected) as ei:
            validate_target_url(
                "https://www.news.gov.hk:8443/x", RULES, resolver=fake_resolver
            )
        assert ei.value.reason is RejectReason.PORT_NOT_ALLOWED


class TestFetcherLimits:
    """spec 16.1 用例 9-10：内容限制 + 重定向次数上限（经 MockTransport）。"""

    def _settings(self) -> Settings:
        return Settings(
            api_key_fastgpt="x",
            connect_timeout_s=1,
            read_timeout_s=1,
            total_timeout_s=2,
            max_redirects=2,
        )

    def test_case9_content_type_and_size_limit(self):
        """用例 9：不允许的内容类型 / 超大响应体必须中止。"""
        import httpx

        # 内容类型不允许
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, headers={"content-type": "application/zip"}, content=b"x")
        )
        with pytest.raises(FetchAborted):
            fetch_url("https://www.news.gov.hk/f.zip", RULES, self._settings(), transport=transport, resolver=fake_resolver)

        # 声明长度超限（HTML 上限 10MB）
        transport = httpx.MockTransport(
            lambda req: httpx.Response(
                200,
                headers={"content-type": "text/html", "content-length": str(20 * 1024 * 1024)},
                content=b"",
            )
        )
        with pytest.raises(FetchAborted):
            fetch_url("https://www.news.gov.hk/big.html", RULES, self._settings(), transport=transport, resolver=fake_resolver)

        # 实际流式超限（服务器谎报小 content-length）
        transport = httpx.MockTransport(
            lambda req: httpx.Response(
                200,
                headers={"content-type": "text/html", "content-length": "100"},
                content=b"a" * (11 * 1024 * 1024),
            )
        )
        with pytest.raises(FetchAborted):
            fetch_url("https://www.news.gov.hk/liar.html", RULES, self._settings(), transport=transport, resolver=fake_resolver)

    def test_extra_js_content_type_allowed(self):
        """补充：application/x-javascript 放行（js_menu 发现方式的硬前提）。

        鲁港通 - TID 全站栏目树在静态 .js 菜单文件里（栏目页是 JS 空壳），实测
        Content-Type 为 application/x-javascript；该类型不在白名单时菜单文件会被
        FetchAborted，js_menu 发现层直接瘫痪。"""
        import httpx

        transport = httpx.MockTransport(
            lambda req: httpx.Response(
                200,
                headers={"content-type": "application/x-javascript"},
                content=b'var tc_topMenu = {"1":["a","b.html","","1","N",{}]};',
            )
        )
        result = fetch_url(
            "https://www.news.gov.hk/js/data/menu.js",
            RULES,
            self._settings(),
            transport=transport,
            resolver=fake_resolver,
        )
        assert result.content.startswith(b"var tc_topMenu")

    def test_case10_redirect_limit(self):
        """用例 10：重定向次数超上限必须中止。"""
        import httpx

        def handler(request: httpx.Request) -> httpx.Response:
            # 鲁港通 - 无限重定向：同一白名单域名内循环，验证次数上限
            return httpx.Response(
                302,
                headers={"location": "https://www.news.gov.hk/loop"},
            )

        transport = httpx.MockTransport(handler)
        with pytest.raises(FetchAborted) as ei:
            fetch_url(
                "https://www.news.gov.hk/start",
                RULES,
                self._settings(),
                transport=transport,
                resolver=fake_resolver,
            )
        assert ei.value.reason is RejectReason.REDIRECT_TOO_MANY

    def test_extra_403_raises_fetch_blocked(self):
        """补充：403/429 上抛 FetchBlocked（调用方退避，不重试轰炸）。"""
        import httpx

        transport = httpx.MockTransport(
            lambda req: httpx.Response(403, headers={"content-type": "text/html"}, content=b"forbidden")
        )
        with pytest.raises(FetchBlocked):
            fetch_url(
                "https://www.news.gov.hk/x",
                RULES,
                self._settings(),
                transport=transport,
                resolver=fake_resolver,
            )

    def test_extra_redirect_each_hop_validated(self):
        """补充：重定向每跳都重新校验（跳到白名单外域名直接中止）。"""
        import httpx

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/hop1":
                return httpx.Response(302, headers={"location": "https://evil.example.com/hop2"})
            return httpx.Response(200, headers={"content-type": "text/html"}, content=b"ok")

        transport = httpx.MockTransport(handler)
        with pytest.raises(FetchAborted) as ei:
            fetch_url(
                "https://www.news.gov.hk/hop1",
                RULES,
                self._settings(),
                transport=transport,
                resolver=fake_resolver,
            )
        assert ei.value.reason is RejectReason.REDIRECT_OUT_OF_ALLOWLIST

    def test_post_method_sent_when_configured(self):
        """鲁港通 - 济南市政府文件库 do-search 接口只接受 POST（实测 GET 返回 500）。
        fetch_url 须支持 method='POST'，api_json 两段式发现才能请求列表接口。
        MockTransport handler 回读实际发出的 request.method，确认不是默认 GET。"""
        import httpx

        seen: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["method"] = request.method
            return httpx.Response(
                200, headers={"content-type": "application/json"}, content=b'{"success":true}'
            )

        transport = httpx.MockTransport(handler)
        result = fetch_url(
            "https://www.news.gov.hk/api-gateway/do-search?pageSize=100&pageNo=1",
            RULES,
            self._settings(),
            method="POST",
            transport=transport,
            resolver=fake_resolver,
        )
        # 关键：实际发出 POST（非 GET）；JSON 响应正常返回
        assert seen["method"] == "POST"
        assert result.http_status == 200
        assert result.content == b'{"success":true}'
