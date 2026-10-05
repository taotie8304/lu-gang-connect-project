# 鲁港通 - /v1/verify 实时核验接口（spec 7.1）：给定 URL，先白名单+SSRF 校验，
# 再轻量 HEAD/GET 探测（经 fetch_url 的安全通道），返回可达性与最终地址。
from __future__ import annotations

import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import require_fastgpt_key
from app.api.rate_limit import RateLimitExceeded, check_rate_limit
from app.config import get_settings
from app.database import get_db
from app.rules import rule_loader
from app.security.fetcher import FetchAborted, FetchBlocked, fetch_url
from app.security.url_validator import URLRejected, validate_target_url

logger = logging.getLogger("lugang.osg.verify")

router = APIRouter(prefix="/v1", tags=["verify"])


class VerifyRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048, description="待核验的官方来源 URL")


class VerifyResponse(BaseModel):
    allowed: bool
    reason: str | None = None
    reachable: bool = False
    http_status: int | None = None
    final_url: str | None = None
    content_type: str | None = None
    content_sha256: str | None = None


@router.post("/verify", response_model=VerifyResponse)
def verify_source(
    payload: VerifyRequest,
    actor: str = Depends(require_fastgpt_key),
    db: Session = Depends(get_db),
) -> VerifyResponse:
    try:
        check_rate_limit(f"verify:{actor}", max_requests=30, window_s=60)
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请稍后再试",
        ) from exc

    rules = rule_loader.load(db)

    # 鲁港通 - 第一步：静态白名单 + SSRF 校验（不发网络请求即可拒绝绝大多数非法 URL）
    try:
        validated = validate_target_url(payload.url, rules)
    except URLRejected as exc:
        return VerifyResponse(allowed=False, reason=exc.reason.value)

    # 鲁港通 - 第二步：真实探测（走 fetch_url 的全部安全约束：重定向逐跳校验、
    # 内容类型白名单、大小上限）；探测失败不影响 allowed 判定，只影响 reachable
    settings = get_settings()
    try:
        result = fetch_url(validated.url, rules, settings)
    except FetchBlocked as exc:
        # 401/403/429：来源活着但拒绝当前抓取节奏，URL 本身仍算白名单内
        return VerifyResponse(
            allowed=True,
            reason=f"source_blocked_http_{exc.http_status}",
            reachable=False,
            final_url=exc.url,
        )
    except FetchAborted as exc:
        return VerifyResponse(
            allowed=True, reason=f"fetch_aborted:{exc.reason.value}", reachable=False
        )
    except Exception:  # noqa: BLE001 - 网络层异常（超时/DNS/连接拒绝）
        logger.exception("verify fetch failed: %s", validated.url)
        return VerifyResponse(allowed=True, reason="network_error", reachable=False)

    return VerifyResponse(
        allowed=True,
        reachable=True,
        http_status=result.http_status,
        final_url=result.final_url,
        content_type=result.content_type,
        content_sha256=hashlib.sha256(result.content).hexdigest(),
    )
