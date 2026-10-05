# 鲁港通 - OSG 数据模型（spec 第 5 节：source / source_domain_rule / document /
# document_version / crawl_run / crawl_task / audit_log）
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CHAR,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Source(Base):
    """官方来源（spec 5.1）。"""

    __tablename__ = "source"

    id: Mapped[uuid.UUID] = _uuid_pk()
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    source_group: Mapped[str] = mapped_column(String(80), nullable=False)
    organization: Mapped[str | None] = mapped_column(Text)
    trust_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    discovery_method: Mapped[str] = mapped_column(String(30), nullable=False)
    schedule_cron: Mapped[str | None] = mapped_column(String(100))
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    max_pages_per_run: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    max_depth: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # 鲁港通 - Phase 0 实测：大陆政务网站对境外数据中心 IP 仅 HTTP 80 放行，需显式放行
    allow_http: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    force_ipv4: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 鲁港通 - 发现端点配置（RSS/sitemap/listing URL 列表等，来源为 sources.yaml 导入）
    discovery_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    domain_rules: Mapped[list["SourceDomainRule"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(back_populates="source")

    def now_utc() -> datetime:  # noqa: N805 - 供测试使用的统一 UTC 时钟
        return datetime.now(timezone.utc)


class SourceDomainRule(Base):
    """域名与路径白名单（spec 5.2）。所有抓取请求必须命中其一。"""

    __tablename__ = "source_domain_rule"
    __table_args__ = (UniqueConstraint("source_id", "hostname", "path_prefix"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source.id", ondelete="CASCADE"), nullable=False
    )
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    allow_subdomains: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    path_prefix: Mapped[str] = mapped_column(Text, nullable=False, default="/")
    allow_http: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allowed_ports: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    source: Mapped[Source] = relationship(back_populates="domain_rules")


class Document(Base):
    """逻辑文档（spec 5.3）。status: candidate/parsed/approved/rejected/
    superseded/archived/fetch_failed。"""

    __tablename__ = "document"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source.id"), nullable=False)
    canonical_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    document_type: Mapped[str | None] = mapped_column(String(40))
    language: Mapped[str | None] = mapped_column(String(12))
    organization: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="candidate")
    latest_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    fastgpt_dataset_id: Mapped[str | None] = mapped_column(Text)
    fastgpt_document_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    source: Mapped[Source] = relationship(back_populates="documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_document_source_status", "source_id", "status"),)


class DocumentVersion(Base):
    """文档版本（spec 5.4）。正文 hash 不变不建新版本。"""

    __tablename__ = "document_version"
    __table_args__ = (UniqueConstraint("document_id", "content_sha256"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document.id", ondelete="CASCADE"), nullable=False
    )
    fetched_url: Mapped[str] = mapped_column(Text, nullable=False)
    final_url: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100))
    http_status: Mapped[int | None] = mapped_column(Integer)
    etag: Mapped[str | None] = mapped_column(Text)
    last_modified_header: Mapped[str | None] = mapped_column(Text)
    content_sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    raw_object_key: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    extracted_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    fetch_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    parser_version: Mapped[str | None] = mapped_column(String(50))
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    document: Mapped[Document] = relationship(back_populates="versions")


class CrawlRun(Base):
    """每次来源同步的整体记录（spec 5.5）。"""

    __tablename__ = "crawl_run"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discovered_urls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetch_ok: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetch_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    new_docs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_docs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unchanged_docs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="running")
    error_summary: Mapped[str | None] = mapped_column(Text)


class CrawlTask(Base):
    """单个 URL 的抓取任务与拒绝原因（spec 5.5）。"""

    __tablename__ = "crawl_task"

    id: Mapped[uuid.UUID] = _uuid_pk()
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("crawl_run.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    reject_reason: Mapped[str | None] = mapped_column(String(80))
    redirect_chain: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    http_status: Mapped[int | None] = mapped_column(Integer)
    bytes_downloaded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuditLog(Base):
    """审计日志（spec 5.5）。不记录用户敏感原文。"""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = _uuid_pk()
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False, default="system")
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (Index("ix_audit_event_time", "event_type", "created_at"),)


class ImportMap(Base):
    """FastGPT 导入映射（design.md §7.3.5）：document ↔ collection 幂等记录。

    status: imported（已导入最新版本）/ skipped_duplicate（同源同内容重复未导入）/
    failed（导入失败，下轮重试）。版本变化重建后仍记 imported（sha 更新为新版本）。
    """

    __tablename__ = "import_map"

    id: Mapped[uuid.UUID] = _uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    dataset_id: Mapped[str] = mapped_column(Text, nullable=False)
    collection_id: Mapped[str | None] = mapped_column(Text)
    version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    content_sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="imported")
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_import_map_status", "status"),
        Index("ix_import_map_sha", "content_sha256"),
    )
