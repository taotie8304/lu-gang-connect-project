# 鲁港通 - 政务 CDN 节点可达性兜底（2026-11-10）
# 现象：香港采集节点解析 *.jinan.gov.cn 只拿到 103.41.1.x 节点，TCP 可建连但 TLS 握手
# 被静默丢弃（HTTP 80 同样不通）；同一域名的 117.149.202.x 大陆节点从香港实测 100% 可达。
# TCP 一旦建连就不会自动换 IP，故在连接层按域名钉住「经 TLS 探测可达」的节点；
# SNI 与证书校验仍由 httpcore 用原始域名执行（start_tls 的 server_hostname 取自 URL 域），
# 白名单/SSRF 校验也仍在域名层完成，仅替换 A 记录选择，不改变信任边界。
from __future__ import annotations

import ipaddress
import logging
import socket
import ssl
import threading
import time

import httpcore
import httpx

logger = logging.getLogger(__name__)

# 鲁港通 - doh.pub 从香港偶发连接重置，dns.google 稳定；两个都失败再退回系统解析器
_DOH_ENDPOINTS = ("https://dns.google/resolve", "https://doh.pub/dns-query")

_pins: dict[str, tuple[str, float]] = {}
_lock = threading.Lock()


def _is_public_ipv4(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return False
    return ip.version == 4 and ip.is_global


def _doh_candidates(host: str) -> list[str]:
    """取全量 A 记录候选：系统解析器只返回其中一组（恰好全是不可达节点）。"""
    for endpoint in _DOH_ENDPOINTS:
        try:
            response = httpx.get(
                endpoint,
                params={"name": host, "type": "A"},
                headers={"accept": "application/dns-json"},
                timeout=6.0,
            )
            data = response.json()
        except Exception as exc:  # noqa: BLE001 - DoH 不可用时退回系统解析，不阻断抓取
            logger.warning("DoH %s 查询 %s 失败: %s", endpoint, host, exc)
            continue
        candidates: list[str] = []
        for answer in data.get("Answer", []):
            value = str(answer.get("data", ""))
            if answer.get("type") == 1 and _is_public_ipv4(value) and value not in candidates:
                candidates.append(value)
        if candidates:
            return candidates
    try:
        infos = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
    except OSError:
        return []
    return list(dict.fromkeys(info[4][0] for info in infos if _is_public_ipv4(info[4][0])))


def _tls_reachable(host: str, ip: str, timeout: float) -> bool:
    context = ssl.create_default_context()
    try:
        with socket.create_connection((ip, 443), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=host):
                return True
    except OSError:
        return False


def cached_pin(host: str) -> str | None:
    now = time.monotonic()
    with _lock:
        hit = _pins.get(host)
        if hit and hit[1] > now:
            return hit[0]
        if hit:
            _pins.pop(host, None)
    return None


def resolve_reachable_ip(
    host: str,
    *,
    ttl_s: float = 900.0,
    probe_timeout_s: float = 4.0,
) -> str | None:
    """返回可完成 TLS 握手的节点 IP；全部候选都不通时返回 None（保留原始异常）。"""
    hit = cached_pin(host)
    if hit:
        return hit
    for ip in _doh_candidates(host):
        if _tls_reachable(host, ip, probe_timeout_s):
            with _lock:
                _pins[host] = (ip, time.monotonic() + ttl_s)
            logger.warning("%s: 系统解析节点不可达，改钉可达节点 %s", host, ip)
            return ip
    return None


class PinnedBackend(httpcore.SyncBackend):
    """connect_tcp 时把域名换成钉住的 IP；TLS 的 SNI/证书仍由原始域名决定。"""

    def __init__(self, pins: dict[str, str]) -> None:
        self._pins = pins

    def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options=None,
    ):
        return super().connect_tcp(
            self._pins.get(host, host),
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )


def pin_transport(transport: httpx.HTTPTransport, pins: dict[str, str]) -> None:
    """把已建好的 transport 的连接后端换成钉住 IP 的实现（保留 SSL 上下文等原配置）。"""
    pool = getattr(transport, "_pool", None)
    if pool is None or not hasattr(pool, "_network_backend"):
        logger.warning("httpx 版本不兼容 DNS 兜底（_pool 结构变化），本次按原解析重试")
        return
    pool._network_backend = PinnedBackend(pins)
