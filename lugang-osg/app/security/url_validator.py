# 鲁港通 - 统一 URL 校验器（spec 6.1/6.2）：所有要请求的 URL（含 RSS/sitemap 发现链接、
# 详情链接、重定向目标）必须先经过 validate_target_url；默认拒绝，不在白名单一律拒绝。
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass, field
from enum import Enum
from urllib.parse import urlsplit


class RejectReason(str, Enum):
    """拒绝原因（写入审计日志，spec 5.5）。"""

    MALFORMED_URL = "MALFORMED_URL"
    BAD_SCHEME = "BAD_SCHEME"                      # http 且来源未放行 / 非允许协议
    USERINFO_IN_URL = "USERINFO_IN_URL"
    PORT_NOT_ALLOWED = "PORT_NOT_ALLOWED"
    HOSTNAME_FORBIDDEN = "HOSTNAME_FORBIDDEN"      # localhost 等
    NOT_IN_ALLOWLIST = "NOT_IN_ALLOWLIST"
    RESOLUTION_FAILED = "RESOLUTION_FAILED"
    PRIVATE_IP = "PRIVATE_IP"                      # 含 loopback/link-local/multicast/
    #                                          reserved/unspecified/metadata
    REDIRECT_TOO_MANY = "REDIRECT_TOO_MANY"
    REDIRECT_OUT_OF_ALLOWLIST = "REDIRECT_OUT_OF_ALLOWLIST"


class URLRejected(Exception):
    """URL 校验失败。所有抓取层必须捕获并记录审计，不得绕过。"""

    def __init__(self, reason: RejectReason, detail: str = "") -> None:
        self.reason = reason
        self.detail = detail
        super().__init__(f"{reason.value}: {detail}")


@dataclass(frozen=True)
class DomainRule:
    """单条域名白名单规则（对应 source_domain_rule 表）。"""

    hostname: str
    allow_subdomains: bool = False
    path_prefix: str = "/"
    allow_http: bool = False
    allowed_ports: frozenset[int] = frozenset()


@dataclass(frozen=True)
class ValidatedURL:
    """校验通过的目标 URL 及解析结果。"""

    url: str
    scheme: str
    hostname: str
    port: int
    matched_rule: DomainRule
    resolved_ips: tuple[str, ...] = field(default_factory=tuple)


_FORBIDDEN_HOSTNAMES = frozenset(
    {"localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"}
)


def normalize_hostname(hostname: str) -> str:
    """IDNA 归一化并转小写；已是 ASCII 则直接小写。"""
    host = hostname.strip().rstrip(".")
    try:
        host.encode("ascii")
        return host.lower()
    except UnicodeEncodeError:
        pass
    try:
        return host.encode("idna").decode("ascii").lower()
    except Exception as exc:  # noqa: BLE001 - idna 失败即视为非法主机名
        raise URLRejected(RejectReason.MALFORMED_URL, f"idna normalize failed: {hostname}") from exc


def _is_ip_forbidden(ip_text: str) -> bool:
    """私网/回环/链路本地/组播/保留/未指定/云 metadata 地址全部禁止（spec 6.1）。"""
    try:
        ip = ipaddress.ip_address(ip_text)
    except ValueError:
        return True
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        # 鲁港通 - ipaddress 未单列的云 metadata 网段兜底（169.254.169.254 已属 link-local）
        or ip in ipaddress.ip_network("100.64.0.0/10")  # CGNAT 共享地址段
    )


def _match_rule(hostname: str, path: str, scheme: str, rules: tuple[DomainRule, ...]) -> DomainRule:
    """默认拒绝：hostname+path 必须命中白名单其一；后缀伪造（gov.hk.evil.example）不会命中。"""
    for rule in rules:
        if rule.allow_subdomains:
            host_ok = hostname == rule.hostname or hostname.endswith("." + rule.hostname)
        else:
            host_ok = hostname == rule.hostname
        if not host_ok:
            continue
        if not path.startswith(rule.path_prefix):
            continue
        # 鲁港通 - scheme 放行：默认仅 https；rule.allow_http 的来源放行 http（Phase 0 实测
        # 山东政务云仅 80 端口对境外数据中心放行，spec 6.1 的修订见 phase0 清单第六节）
        if scheme == "https":
            scheme_ok = True
        else:
            scheme_ok = scheme == "http" and rule.allow_http
        if not scheme_ok:
            continue
        return rule
    raise URLRejected(
        RejectReason.NOT_IN_ALLOWLIST,
        f"host={hostname} path={path} scheme={scheme} matched no enabled rule",
    )


def resolve_all_ips(hostname: str) -> tuple[str, ...]:
    """DNS 全量解析（A + AAAA），任一解析结果为禁止 IP 即视为 SSRF 风险。"""
    try:
        infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise URLRejected(RejectReason.RESOLUTION_FAILED, f"dns: {hostname}: {exc}") from exc
    ips: list[str] = []
    for info in infos:
        ip_text = info[4][0]
        if ip_text not in ips:
            ips.append(ip_text)
    if not ips:
        raise URLRejected(RejectReason.RESOLUTION_FAILED, f"dns empty: {hostname}")
    return tuple(ips)


def validate_target_url(
    url: str,
    rules: tuple[DomainRule, ...] | list[DomainRule],
    *,
    resolver=None,
) -> ValidatedURL:
    """校验目标 URL（spec 6.1 伪代码的完整实现）。

    resolver 参数仅供测试注入假 DNS 结果；生产留空走真实解析。
    """
    if not isinstance(url, str) or not url.strip():
        raise URLRejected(RejectReason.MALFORMED_URL, "empty url")

    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        raise URLRejected(RejectReason.MALFORMED_URL, str(exc)) from exc

    if parts.scheme not in ("https", "http"):
        raise URLRejected(RejectReason.BAD_SCHEME, f"scheme={parts.scheme!r}")

    if parts.username or parts.password:
        raise URLRejected(RejectReason.USERINFO_IN_URL, url)

    if parts.hostname is None:
        raise URLRejected(RejectReason.MALFORMED_URL, f"no hostname: {url}")

    hostname = normalize_hostname(parts.hostname)
    if hostname in _FORBIDDEN_HOSTNAMES or not hostname:
        raise URLRejected(RejectReason.HOSTNAME_FORBIDDEN, hostname)

    rule = _match_rule(hostname, parts.path or "/", parts.scheme, tuple(rules))

    # 鲁港通 - 端口：显式端口必须命中规则的 allowed_ports；未显式端口按 scheme 默认 443/80
    if parts.port is not None:
        port = parts.port
        allowed = rule.allowed_ports or (
            frozenset({80}) if parts.scheme == "http" else frozenset({443})
        )
        if port not in allowed:
            raise URLRejected(RejectReason.PORT_NOT_ALLOWED, f"port={port}")
    else:
        port = 80 if parts.scheme == "http" else 443

    # 鲁港通 - DNS SSRF 检查（在白名单命中之后：白名单外的主机名直接拒绝，无需 DNS）
    resolved = resolver(hostname) if resolver is not None else resolve_all_ips(hostname)
    for ip_text in resolved:
        if _is_ip_forbidden(ip_text):
            raise URLRejected(RejectReason.PRIVATE_IP, f"{hostname} -> {ip_text}")

    return ValidatedURL(
        url=_rebuild_url(parts, hostname, port),
        scheme=parts.scheme,
        hostname=hostname,
        port=port,
        matched_rule=rule,
        resolved_ips=tuple(resolved),
    )


def _rebuild_url(parts, hostname: str, port: int) -> str:
    """重建归一化 URL（丢弃 userinfo，保留 path/query/fragment）。"""
    default_port = 80 if parts.scheme == "http" else 443
    netloc = hostname if port == default_port else f"{hostname}:{port}"
    return parts._replace(netloc=netloc).geturl()


def validate_redirect_target(
    location: str, base_url: str, rules: tuple[DomainRule, ...] | list[DomainRule], *, resolver=None
) -> ValidatedURL:
    """校验重定向 Location（spec 6.2）：相对地址基于 base_url 拼接后重新走完整校验。"""
    from urllib.parse import urljoin

    absolute = urljoin(base_url, location.strip())
    return validate_target_url(absolute, rules, resolver=resolver)
