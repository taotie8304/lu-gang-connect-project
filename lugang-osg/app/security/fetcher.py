# 鲁港通 - 安全抓取客户端（spec 6.2/6.3）：手动逐步重定向（每跳重新校验白名单）、
# 内容类型白名单、大小上限、超时控制；403/429 上抛供 Worker 退避，绝不重试轰炸。
from __future__ import annotations

from dataclasses import dataclass, field

import httpx

from app.config import Settings
from app.security.url_validator import (
    DomainRule,
    RejectReason,
    URLRejected,
    validate_redirect_target,
    validate_target_url,
)

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}
_BLOCKED_STATUSES = {401, 403, 429}


@dataclass(frozen=True)
class FetchResult:
    """一次成功抓取的结果（原始字节 + 元信息）。"""

    final_url: str
    http_status: int
    content_type: str          # 已归一化（去 charset 等参数）
    content: bytes
    redirect_chain: tuple[str, ...] = field(default_factory=tuple)


class FetchBlocked(Exception):
    """来源返回 401/403/429：调用方必须退避（spec 6.4：至少 24h 后再查）。"""

    def __init__(self, http_status: int, url: str) -> None:
        self.http_status = http_status
        self.url = url
        super().__init__(f"HTTP {http_status} at {url}")


class FetchAborted(Exception):
    """内容类型不允许 / 大小超限 / 重定向超次。"""

    def __init__(self, reason: RejectReason, detail: str) -> None:
        self.reason = reason
        self.detail = detail
        super().__init__(f"{reason.value}: {detail}")


def normalize_content_type(content_type: str | None) -> str:
    """去参数归一化：'text/html; charset=utf-8' -> 'text/html'。"""
    return (content_type or "").split(";", 1)[0].strip().lower()


def _max_bytes_for(content_type: str, settings: Settings) -> int:
    return settings.max_bytes_pdf if content_type == "application/pdf" else settings.max_bytes_html


def fetch_url(
    url: str,
    rules: tuple[DomainRule, ...] | list[DomainRule],
    settings: Settings,
    *,
    method: str = "GET",
    transport: httpx.BaseTransport | None = None,
    resolver=None,
) -> FetchResult:
    """按 spec 安全规则抓取一个 URL。

    method：请求方法，默认 GET；政务列表接口（如济南文件库 do-search）只接受 POST。
    transport/resolver 仅供测试注入；生产使用真实网络（force_ipv4 经 local_address 绑定实现）。
    """
    current = validate_target_url(url, rules, resolver=resolver)

    # 鲁港通 - Phase 0 实测：境外服务器 DNS 会返回大陆政务网站 AAAA 记录但无 IPv6 出口路由，
    # 绑定 0.0.0.0 本地地址可强制 httpx 仅走 IPv4
    local_addr = "0.0.0.0" if settings.force_ipv4 else None
    client_kwargs: dict = {
        "follow_redirects": False,
        "timeout": httpx.Timeout(
            connect=settings.connect_timeout_s,
            read=settings.read_timeout_s,
            write=settings.read_timeout_s,
            pool=settings.total_timeout_s,
        ),
        "headers": {"User-Agent": settings.user_agent},
    }
    if transport is not None:
        client_kwargs["transport"] = transport
    elif local_addr is not None:
        client_kwargs["transport"] = httpx.HTTPTransport(local_address=local_addr)

    chain: list[str] = [current.url]
    redirects = 0

    with httpx.Client(**client_kwargs) as client:
        while True:
            # 鲁港通 - method 可配 POST（济南文件库 do-search 只接受 POST，GET 返 500）；
            # 逐跳重定向复用同一 method（实测 do-search 无重定向，详情走默认 GET）。
            response = client.request(method, current.url)
            if response.status_code in _REDIRECT_STATUSES:
                location = response.headers.get("location", "")
                response.close()
                if not location:
                    raise FetchAborted(RejectReason.MALFORMED_URL, "redirect without Location")
                redirects += 1
                if redirects > settings.max_redirects:
                    raise FetchAborted(
                        RejectReason.REDIRECT_TOO_MANY, f"{redirects} redirects from {url}"
                    )
                try:
                    # 鲁港通 - 每一跳都重新执行完整白名单 + SSRF 校验（spec 6.2）
                    current = validate_redirect_target(
                        location, current.url, rules, resolver=resolver
                    )
                except URLRejected as exc:
                    raise FetchAborted(
                        RejectReason.REDIRECT_OUT_OF_ALLOWLIST, str(exc)
                    ) from exc
                chain.append(current.url)
                continue

            if response.status_code in _BLOCKED_STATUSES:
                blocked_url = str(response.url)
                response.close()
                raise FetchBlocked(response.status_code, blocked_url)

            if response.status_code != 200:
                response.close()
                raise FetchAborted(
                    RejectReason.MALFORMED_URL, f"unexpected status {response.status_code}"
                )

            content_type = normalize_content_type(response.headers.get("content-type"))
            if content_type not in settings.allowed_content_types:
                response.close()
                raise FetchAborted(
                    RejectReason.MALFORMED_URL,
                    f"content-type not allowed: {content_type!r}",
                )

            limit = _max_bytes_for(content_type, settings)
            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > limit:
                response.close()
                raise FetchAborted(
                    RejectReason.MALFORMED_URL,
                    f"size {declared} exceeds limit {limit} for {content_type}",
                )

            # 鲁港通 - 流式按上限读取：声明长度可被伪造，必须边读边截断
            buf = bytearray()
            for chunk in response.iter_bytes(64 * 1024):
                buf.extend(chunk)
                if len(buf) > limit:
                    response.close()
                    raise FetchAborted(
                        RejectReason.MALFORMED_URL,
                        f"downloaded > {limit} bytes for {content_type}",
                    )
            response.close()
            return FetchResult(
                final_url=str(response.url),
                http_status=response.status_code,
                content_type=content_type,
                content=bytes(buf),
                redirect_chain=tuple(chain),
            )
