# 鲁港通 - OSG 定时调度（spec 第 12 节）：APScheduler 按 source.schedule_cron
# 周期触发同步。串行执行（与手动触发共用互斥锁）；同刻多源排队等待而非跳过，
# 避免 cron 扎堆下弱势源长期饿死（2026-10-03 修复）。另含每日自动导入任务。
from __future__ import annotations

import logging
import threading

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

logger = logging.getLogger("lugang.osg.scheduler")

_scheduler: BackgroundScheduler | None = None

# 鲁港通 - 同刻多源串行排队：后到者等待锁释放的上限（秒），超时放弃本轮等下轮
_SYNC_WAIT_TIMEOUT_S = 3600

# 鲁港通 - 每日自动导入触发时刻（cron 按容器本地时区=UTC 解释；15:30 UTC = 23:30 香港）
_IMPORT_CRON = "30 15 * * *"

# 鲁港通 - 自动导入互斥锁（仅防本任务自重叠；导入不抓外网，与采集锁独立）
_import_lock = threading.Lock()


def start_scheduler(app) -> None:
    """启动后台调度（FastAPI lifespan 调用）。加载 DB 中全部 enabled 且有 cron 的来源。"""
    global _scheduler
    if _scheduler is not None:
        return

    from app.database import SessionLocal
    from app.ingest.pipeline import sync_source
    from app.models import Source

    scheduler = BackgroundScheduler(timezone="Asia/Hong_Kong")

    session = SessionLocal()
    try:
        sources = session.execute(
            select(Source).where(Source.enabled.is_(True), Source.schedule_cron.isnot(None))
        ).scalars().all()
        for src in sources:
            job_id = f"sync_{src.code}"
            scheduler.add_job(
                _make_job(src.code),
                CronTrigger.from_crontab(src.schedule_cron),
                id=job_id,
                name=job_id,
                max_instances=1,        # 鲁港通 - 上一轮没跑完不再叠加
                coalesce=True,          # 错过的多次触发合并为一次
                misfire_grace_time=3600,
            )
        # 鲁港通 - 每日自动导入（采集 → 知识库，幂等可重跑；高校源暂缓自动跳过）
        scheduler.add_job(
            _make_import_job(),
            CronTrigger.from_crontab(_IMPORT_CRON),
            id="fastgpt_daily_import",
            name="fastgpt_daily_import",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=7200,
        )
    finally:
        session.close()

    scheduler.start()
    _scheduler = scheduler
    logger.info("scheduler started with %d jobs", len(scheduler.get_jobs()))


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def _make_job(code: str):
    """构造一个来源的同步 job（独立会话 + 锁，与手动触发互斥）。

    同刻到期的多个源按到达顺序排队执行（等待锁释放，最长 _SYNC_WAIT_TIMEOUT_S）；
    旧行为「锁被占立即跳过」在 cron 扎堆时会让同一批弱势源每轮都被跳过而长期停更。
    """
    from app.database import SessionLocal
    from app.ingest.pipeline import sync_source
    from app.models import Source
    from app.api.admin import _sync_lock

    def _run():
        if not _sync_lock.acquire(timeout=_SYNC_WAIT_TIMEOUT_S):
            logger.info("skip scheduled sync %s: lock wait timeout", code)
            return
        try:
            session = SessionLocal()
            try:
                src = session.execute(
                    select(Source).where(Source.code == code)
                ).scalar_one_or_none()
                if src is None or not src.enabled:
                    return
                sync_source(session, src)
            finally:
                session.close()
        finally:
            _sync_lock.release()

    return _run


def _make_import_job():
    """构造每日自动导入 job：把各源新采集的候选文档导入对应知识库。

    幂等（import_map 指纹未变跳过）；高校源（2026-09-13 用户决策暂缓）与
    未配置路由的源自动跳过。与采集互不阻塞（导入只访问 FastGPT，不抓外网）。
    """
    from app.config import get_settings
    from app.database import SessionLocal
    from app.fastgpt.client import FastGPTClient
    from app.fastgpt.importer import run_import
    from app.fastgpt.mapping import is_routable
    from app.models import Source

    def _run():
        if _import_lock.locked():
            logger.info("skip scheduled import: previous run still in progress")
            return
        with _import_lock:
            settings = get_settings()
            if not settings.fastgpt_api_key:
                logger.warning("skip scheduled import: OSG_FASTGPT_API_KEY not configured")
                return
            client = FastGPTClient(settings.fastgpt_base_url, settings.fastgpt_api_key)
            session = SessionLocal()
            try:
                sources = session.execute(
                    select(Source).where(Source.enabled.is_(True)).order_by(Source.code)
                ).scalars().all()
                for src in sources:
                    if not is_routable(src.code):
                        continue
                    try:
                        report = run_import(
                            session,
                            client,
                            src.code,
                            interval=settings.fastgpt_interval_s,
                            chunk_size=settings.fastgpt_chunk_size,
                        )
                        logger.info(
                            "scheduled import %s: %s", src.code, report.summary_line()
                        )
                    except Exception:
                        logger.exception("scheduled import failed: %s", src.code)
            finally:
                session.close()
                client.close()

    return _run
