# 鲁港通 - Redis 滑动窗口限流（spec 12.2：接口防刷 + 单来源抓取节奏）
import time
import uuid

import redis

from app.config import get_settings


class RateLimitExceeded(Exception):
    """超过限流阈值。调用方应返回 429，绝不放行。"""


def _make_client(url: str) -> redis.Redis:
    return redis.Redis.from_url(url, decode_responses=True)


_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    """惰性单例 Redis 连接（生产复用现有容器，经 172.17.0.1 访问）。"""
    global _client
    if _client is None:
        _client = _make_client(get_settings().redis_url)
    return _client


def reset_redis_for_tests() -> None:
    """测试专用：重置单例（fakeredis 注入）。"""
    global _client
    _client = None


def check_rate_limit(
    key: str,
    *,
    max_requests: int = 30,
    window_s: int = 60,
    client: redis.Redis | None = None,
) -> None:
    """滑动窗口限流；超出抛 RateLimitExceeded。

    Redis 不可用时降级为放行并记日志（限流是防刷手段，不应阻断核心功能）。
    """
    r = client if client is not None else get_redis()
    now = int(time.time())
    member = f"{now}:{uuid.uuid4().hex}"  # 鲁港通 - 同秒多次请求必须可区分（早期用 id(key) 会互相覆盖）
    try:
        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, now - window_s)
        pipe.zcard(key)
        pipe.zadd(key, {member: now})
        pipe.expire(key, window_s + 1)
        _, count_before, _, _ = pipe.execute()
    except redis.RedisError:
        # 鲁港通 - Redis 故障降级：放行（防刷不阻断业务），生产有 /health 监控 Redis 状态
        return
    if count_before >= max_requests:
        raise RateLimitExceeded(f"rate limit exceeded: {count_before}/{max_requests} in {window_s}s")
