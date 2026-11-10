# 鲁港通 - 政务 CDN 节点兜底单测（2026-11-10；不发起真实网络请求）
# 全部通过注入的 DoH 假响应 / 假探测函数验证候选选择与缓存语义。
from __future__ import annotations

import httpcore
import httpx
import pytest

from app.security import dns_fallback


@pytest.fixture(autouse=True)
def _clear_pins():
    dns_fallback._pins.clear()
    yield
    dns_fallback._pins.clear()


def test_resolve_picks_first_reachable(monkeypatch):
    """候选按 DoH 顺序探测，返回第一个能完成 TLS 握手的节点。"""
    monkeypatch.setattr(dns_fallback, "_doh_candidates", lambda host: ["103.41.1.7", "117.149.202.32"])
    probed: list[str] = []

    def fake_probe(host: str, ip: str, timeout: float) -> bool:
        probed.append(ip)
        return ip == "117.149.202.32"

    monkeypatch.setattr(dns_fallback, "_tls_reachable", fake_probe)
    assert dns_fallback.resolve_reachable_ip("www.jinan.gov.cn") == "117.149.202.32"
    assert probed == ["103.41.1.7", "117.149.202.32"]


def test_resolve_caches_pin(monkeypatch):
    """同一域名在 TTL 内只解析一次（后续请求直接复用钉点）。"""
    lookups: list[str] = []
    monkeypatch.setattr(
        dns_fallback, "_doh_candidates", lambda host: lookups.append(host) or ["117.149.202.32"]
    )
    monkeypatch.setattr(dns_fallback, "_tls_reachable", lambda host, ip, timeout: True)

    first = dns_fallback.resolve_reachable_ip("www.jinan.gov.cn", ttl_s=60)
    second = dns_fallback.resolve_reachable_ip("www.jinan.gov.cn", ttl_s=60)

    assert first == second == "117.149.202.32"
    assert lookups == ["www.jinan.gov.cn"]


def test_resolve_expired_pin_reprobes(monkeypatch):
    monkeypatch.setattr(dns_fallback, "_doh_candidates", lambda host: ["117.149.202.32"])
    monkeypatch.setattr(dns_fallback, "_tls_reachable", lambda host, ip, timeout: True)

    assert dns_fallback.resolve_reachable_ip("www.jinan.gov.cn", ttl_s=0) == "117.149.202.32"
    assert dns_fallback.cached_pin("www.jinan.gov.cn") is None


def test_resolve_returns_none_when_all_unreachable(monkeypatch):
    """全部候选不通时返回 None，调用方保留原始异常（不掩盖真实故障）。"""
    monkeypatch.setattr(dns_fallback, "_doh_candidates", lambda host: ["103.41.1.7", "103.41.1.18"])
    monkeypatch.setattr(dns_fallback, "_tls_reachable", lambda host, ip, timeout: False)

    assert dns_fallback.resolve_reachable_ip("www.jinan.gov.cn") is None
    assert dns_fallback.cached_pin("www.jinan.gov.cn") is None


def test_doh_candidates_keeps_public_ipv4_only(monkeypatch):
    class FakeResponse:
        def json(self):
            return {
                "Answer": [
                    {"type": 1, "data": "10.0.0.8"},
                    {"type": 1, "data": "117.149.202.32"},
                    {"type": 5, "data": "cname.example"},
                    {"type": 1, "data": "117.149.202.32"},
                ]
            }

    monkeypatch.setattr(dns_fallback.httpx, "get", lambda *args, **kwargs: FakeResponse())
    assert dns_fallback._doh_candidates("www.jinan.gov.cn") == ["117.149.202.32"]


def test_pinned_backend_maps_host(monkeypatch):
    """连接层只替换目标 IP，端口与其余参数原样透传。"""
    seen: list[tuple[str, int]] = []

    def fake_connect(self, host, port, timeout=None, local_address=None, socket_options=None):
        seen.append((host, port))
        return "stream"

    monkeypatch.setattr(httpcore.SyncBackend, "connect_tcp", fake_connect)
    backend = dns_fallback.PinnedBackend({"www.jinan.gov.cn": "117.149.202.32"})

    backend.connect_tcp("www.jinan.gov.cn", 443)
    backend.connect_tcp("www.news.gov.hk", 443)

    assert seen == [("117.149.202.32", 443), ("www.news.gov.hk", 443)]


def test_pin_transport_replaces_network_backend():
    transport = httpx.HTTPTransport()
    try:
        dns_fallback.pin_transport(transport, {"www.jinan.gov.cn": "117.149.202.32"})
        assert isinstance(transport._pool._network_backend, dns_fallback.PinnedBackend)
    finally:
        transport.close()
