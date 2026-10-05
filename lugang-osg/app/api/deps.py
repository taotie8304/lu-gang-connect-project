# 鲁港通 - OSG API 鉴权依赖（spec 14：内部服务鉴权，双密钥分离）
import hashlib
import hmac

from fastapi import Header, HTTPException, status

from app.config import get_settings


def _key_hash(key: str) -> str:
    """API Key 只保存 SHA-256 比对，不外泄原值。"""
    return hashlib.sha256(key.encode()).hexdigest()


def _check_api_key(provided: str | None, expected: str) -> None:
    if not expected:
        # 鲁港通 - 未配置密钥时一律拒绝（默认拒绝原则，绝不“无密钥即放行”）
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="服务端未配置 API Key，请检查 OSG_API_KEY_FASTGPT / OSG_API_KEY_ADMIN",
        )
    if provided is None or not hmac.compare_digest(
        _key_hash(provided), _key_hash(expected)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 API Key",
        )


def require_fastgpt_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    """FastGPT 工作流调用侧鉴权（只读类接口）。"""
    _check_api_key(x_api_key, get_settings().api_key_fastgpt)
    return "fastgpt"


def require_admin_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    """管理后台侧鉴权（来源管理/触发同步等写操作）。"""
    _check_api_key(x_api_key, get_settings().api_key_admin)
    return "admin"
