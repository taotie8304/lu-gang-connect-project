# 鲁港通 - OSG API 层测试：鉴权、限流、/v1/verify 行为（fakeredis + stub 规则加载）
# 不依赖真实 DB：SQLite 编译不了 PG 的 UUID/JSONB，改为直接 stub rule_loader。
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.rate_limit import check_rate_limit
from app.database import get_db
from app.main import app
from app.security.url_validator import DomainRule

RULES = (DomainRule(hostname="www.news.gov.hk", path_prefix="/"),)


class _StubRuleLoader:
    """固定返回测试规则，不触 DB。"""

    def __init__(self, rules):
        self.rules = rules

    def load(self, db, *, force=False):
        return self.rules

    def invalidate(self):
        pass


@pytest.fixture()
def client(monkeypatch):
    # 鲁港通 - fakeredis 注入限流 + stub 规则加载，避免依赖真实 Redis/Postgres
    import fakeredis

    import app.api.rate_limit as rl
    import app.api.verify as verify_mod

    fake = fakeredis.FakeStrictRedis()
    monkeypatch.setattr(rl, "get_redis", lambda: fake)
    monkeypatch.setattr(verify_mod, "rule_loader", _StubRuleLoader(RULES))

    def override_get_db():
        yield None  # 鲁港通 - stub loader 不使用 db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _set_fastgpt_key(monkeypatch, key: str = "test-key-123"):
    """设置 API Key 并清缓存（Settings 是 lru_cache）。"""
    monkeypatch.setenv("OSG_API_KEY_FASTGPT", key)
    from app.config import get_settings

    get_settings.cache_clear()
    return key


def test_health_endpoint(client):
    """健康检查：api 存活即返回 200/503，带 checks 明细。"""
    resp = client.get("/health")
    assert resp.status_code in (200, 503)
    assert "checks" in resp.json()


def test_verify_requires_api_key(client, monkeypatch):
    """未配置 API Key 时拒绝（默认拒绝原则，绝无“无密钥即放行”）。"""
    _set_fastgpt_key(monkeypatch, "")  # 显式置空
    resp = client.post("/v1/verify", json={"url": "https://www.news.gov.hk/"})
    assert resp.status_code == 503


def test_verify_rejects_bad_key(client, monkeypatch):
    """错误 API Key 返回 401。"""
    key = _set_fastgpt_key(monkeypatch)
    resp = client.post(
        "/v1/verify",
        json={"url": "https://www.news.gov.hk/"},
        headers={"X-API-Key": "wrong-key"},
    )
    assert resp.status_code == 401


def test_verify_rejects_non_allowlist(client, monkeypatch):
    """白名单外 URL：allowed=false（不发网络请求即拒绝）。"""
    key = _set_fastgpt_key(monkeypatch)
    resp = client.post(
        "/v1/verify",
        json={"url": "https://evil.example.com/x"},
        headers={"X-API-Key": key},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["allowed"] is False
    assert body["reason"] == "NOT_IN_ALLOWLIST"


def test_rate_limit_sliding_window():
    """限流：窗口内超过阈值抛 RateLimitExceeded。"""
    import fakeredis

    fake = fakeredis.FakeStrictRedis()
    for _ in range(5):
        check_rate_limit("rl:test", max_requests=5, window_s=60, client=fake)
    with pytest.raises(Exception):
        check_rate_limit("rl:test", max_requests=5, window_s=60, client=fake)


def test_rate_limit_redis_down_degrades_open():
    """Redis 故障降级：放行不阻断。"""
    # 鲁港通 - 模仿 redis.Redis 但 pipeline 抛 redis.RedisError，验证降级放行逻辑
    try:
        check_rate_limit("rl:down", max_requests=1, window_s=60, client=_RaisingProxy())
    except Exception:
        pytest.fail("Redis 故障时应降级放行，而不是抛异常")


class _RaisingProxy:
    """模仿 redis.Redis 但 pipeline 抛 redis.RedisError。"""

    def pipeline(self):
        import redis

        raise redis.RedisError("connection refused")
