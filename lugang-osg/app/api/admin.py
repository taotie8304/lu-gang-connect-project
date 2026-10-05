# 鲁港通 - OSG 管理接口（spec 第 11/14 节）：sources.yaml 导入、触发同步、
# 同步状态查询。全部 admin 密钥鉴权 + 限流。
from __future__ import annotations

import logging
import threading

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin_key
from app.api.rate_limit import RateLimitExceeded, check_rate_limit
from app.database import get_db
from app.ingest.pipeline import sync_source
from app.ingest.yaml_import import ImportResult, import_sources_yaml
from app.models import CrawlRun, Source
from app.rules import rule_loader

logger = logging.getLogger("lugang.osg.admin")

router = APIRouter(prefix="/admin", tags=["admin"])

# 鲁港通 - 服务器为 2C4G：串行同步锁，避免多个来源并发抓取把带宽与内存打满
_sync_lock = threading.Lock()


class ImportResponse(BaseModel):
    imported: list[str]
    updated: list[str]
    skipped_disabled: list[str]
    errors: list[str]


@router.post("/sources/import", response_model=ImportResponse)
def import_sources(
    file: UploadFile,
    actor: str = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    """上传 sources.yaml 导入/更新来源与域名白名单（幂等，按 code 覆盖）。"""
    try:
        check_rate_limit(f"admin-import:{actor}", max_requests=5, window_s=60)
    except RateLimitExceeded as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "操作过于频繁，请稍后再试") from exc

    yaml_text = file.file.read().decode("utf-8", errors="strict")
    try:
        result: ImportResult = import_sources_yaml(yaml_text, db)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"YAML 格式错误: {exc}") from exc
    except UnicodeDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "文件必须是 UTF-8 编码") from exc
    return ImportResponse(
        imported=result.imported,
        updated=result.updated,
        skipped_disabled=result.skipped_disabled,
        errors=result.errors,
    )


class SyncResponse(BaseModel):
    source_code: str
    started: bool
    message: str


@router.post("/sources/{code}/sync", response_model=SyncResponse)
def trigger_sync(
    code: str,
    background_tasks: BackgroundTasks,
    force: bool = False,
    actor: str = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    """触发一个来源的同步（后台执行；force=true 时已知文档也重抓）。"""
    source = db.execute(select(Source).where(Source.code == code)).scalar_one_or_none()
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"来源不存在: {code}")
    if not source.enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, f"来源已停用: {code}")

    if _sync_lock.locked():
        return SyncResponse(
            source_code=code, started=False, message="已有同步任务在执行，请稍后查询状态"
        )

    # 鲁港通 - BackgroundTasks 拿独立会话（请求会话关闭后不可再用）
    from app.database import SessionLocal

    def _run():
        with _sync_lock:
            session = SessionLocal()
            try:
                src = session.execute(
                    select(Source).where(Source.code == code)
                ).scalar_one_or_none()
                if src is None:
                    return
                stats = sync_source(session, src, force_refetch=force)
                logger.info(
                    "sync %s: discovered=%d new=%d updated=%d unchanged=%d failed=%d rejected=%d",
                    code, stats.discovered, stats.new_docs, stats.updated_docs,
                    stats.unchanged_docs, stats.fetch_failed, stats.rejected,
                )
            finally:
                session.close()

    background_tasks.add_task(_run)
    return SyncResponse(source_code=code, started=True, message="同步已开始")


class RunSummary(BaseModel):
    run_id: str
    source_code: str
    status: str
    started_at: str | None
    finished_at: str | None
    discovered_urls: int
    new_docs: int
    updated_docs: int
    unchanged_docs: int
    fetch_failed: int
    error_summary: str | None


@router.get("/runs")
def list_runs(
    actor: str = Depends(require_admin_key),
    db: Session = Depends(get_db),
    limit: int = 20,
) -> list[RunSummary]:
    """最近的同步运行记录（默认 20 条）。"""
    limit = max(1, min(limit, 100))
    rows = db.execute(
        select(CrawlRun, Source.code)
        .join(Source, CrawlRun.source_id == Source.id)
        .order_by(CrawlRun.started_at.desc())
        .limit(limit)
    ).all()
    return [
        RunSummary(
            run_id=str(run.id),
            source_code=code,
            status=run.status,
            started_at=run.started_at.isoformat() if run.started_at else None,
            finished_at=run.finished_at.isoformat() if run.finished_at else None,
            discovered_urls=run.discovered_urls,
            new_docs=run.new_docs,
            updated_docs=run.updated_docs,
            unchanged_docs=run.unchanged_docs,
            fetch_failed=run.fetch_failed,
            error_summary=run.error_summary,
        )
        for run, code in rows
    ]


@router.post("/rules/reload")
def reload_rules(
    actor: str = Depends(require_admin_key),
    db: Session = Depends(get_db),
):
    """强制刷新白名单规则缓存（改库后立即生效，不用等 60s TTL）。"""
    rule_loader.load(db, force=True)
    return {"message": "白名单规则已刷新"}
