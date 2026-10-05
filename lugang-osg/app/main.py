# 鲁港通 - OSG FastAPI 入口：/health 依赖检查 + /v1/verify 路由挂载。
# 服务只监听内网（docker 网络内），不直接对公网暴露；公网访问必须经反代 + 鉴权。
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.admin import router as admin_router
from app.api.verify import router as verify_router
from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("lugang.osg")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 鲁港通 - 定时调度随服务启停（仅在配了 DB 且非调试时启动；失败不阻断 API）
    sched = None
    if not settings.debug:
        try:
            from app.scheduler import shutdown_scheduler, start_scheduler

            start_scheduler(app)
            sched = True
        except Exception:  # noqa: BLE001 - 调度器启动失败只降级（可手动触发同步）
            logger.exception("scheduler failed to start; manual sync still available")
    yield
    if sched:
        from app.scheduler import shutdown_scheduler

        shutdown_scheduler()


app = FastAPI(
    title="LuGang OSG - Official Source Gateway",
    version="0.2.0",
    docs_url=None if not settings.debug else "/docs",
    redoc_url=None,
    lifespan=lifespan,
)


@app.get("/health")
def health() -> JSONResponse:
    """健康检查：自身存活 + 数据库 + Redis（任一故障返回 503 供监控告警）。"""
    checks: dict[str, bool] = {"api": True}

    # 鲁港通 - 数据库连通性
    try:
        from sqlalchemy import text

        from app.database import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:  # noqa: BLE001
        logger.exception("health: database check failed")
        checks["database"] = False

    # 鲁港通 - Redis 连通性
    try:
        from app.api.rate_limit import get_redis

        checks["redis"] = bool(get_redis().ping())
    except Exception:  # noqa: BLE001
        logger.exception("health: redis check failed")
        checks["redis"] = False

    healthy = all(checks.values())
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={"status": "ok" if healthy else "degraded", "checks": checks},
    )


app.include_router(verify_router)
app.include_router(admin_router)
