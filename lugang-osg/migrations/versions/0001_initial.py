"""OSG Phase 1 初始 schema：source / source_domain_rule / document / document_version /
crawl_run / crawl_task / audit_log（spec 第 5 节）

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# 鲁港通 - revision identifiers
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "source",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(100), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("source_group", sa.String(80), nullable=False),
        sa.Column("organization", sa.Text()),
        sa.Column("trust_level", sa.SmallInteger(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("discovery_method", sa.String(30), nullable=False),
        sa.Column("schedule_cron", sa.String(100)),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False),
        sa.Column("max_pages_per_run", sa.Integer(), nullable=False),
        sa.Column("max_depth", sa.Integer(), nullable=False),
        sa.Column("allow_http", sa.Boolean(), nullable=False),
        sa.Column("force_ipv4", sa.Boolean(), nullable=False),
        sa.Column("discovery_config", JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "source_domain_rule",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "source_id",
            UUID(as_uuid=True),
            sa.ForeignKey("source.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hostname", sa.String(255), nullable=False),
        sa.Column("allow_subdomains", sa.Boolean(), nullable=False),
        sa.Column("path_prefix", sa.Text(), nullable=False),
        sa.Column("allow_http", sa.Boolean(), nullable=False),
        sa.Column("allowed_ports", JSONB(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("source_id", "hostname", "path_prefix"),
    )

    op.create_table(
        "document",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "source_id", UUID(as_uuid=True), sa.ForeignKey("source.id"), nullable=False
        ),
        sa.Column("canonical_url", sa.Text(), nullable=False, unique=True),
        sa.Column("title", sa.Text()),
        sa.Column("document_type", sa.String(40)),
        sa.Column("language", sa.String(12)),
        sa.Column("organization", sa.Text()),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("effective_from", sa.DateTime(timezone=True)),
        sa.Column("effective_until", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("latest_version_id", UUID(as_uuid=True)),
        sa.Column("fastgpt_dataset_id", sa.Text()),
        sa.Column("fastgpt_document_id", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_document_source_status", "document", ["source_id", "status"])

    op.create_table(
        "document_version",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("document.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fetched_url", sa.Text(), nullable=False),
        sa.Column("final_url", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(100)),
        sa.Column("http_status", sa.Integer()),
        sa.Column("etag", sa.Text()),
        sa.Column("last_modified_header", sa.Text()),
        sa.Column("content_sha256", sa.CHAR(64), nullable=False),
        sa.Column("raw_object_key", sa.Text()),
        sa.Column("extracted_text", sa.Text()),
        sa.Column("extracted_metadata", JSONB(), nullable=False),
        sa.Column("fetch_started_at", sa.DateTime(timezone=True)),
        sa.Column(
            "fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("parser_version", sa.String(50)),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("document_id", "content_sha256"),
    )

    op.create_table(
        "crawl_run",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "source_id", UUID(as_uuid=True), sa.ForeignKey("source.id"), nullable=False
        ),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("discovered_urls", sa.Integer(), nullable=False),
        sa.Column("fetch_ok", sa.Integer(), nullable=False),
        sa.Column("fetch_failed", sa.Integer(), nullable=False),
        sa.Column("new_docs", sa.Integer(), nullable=False),
        sa.Column("updated_docs", sa.Integer(), nullable=False),
        sa.Column("unchanged_docs", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("error_summary", sa.Text()),
    )

    op.create_table(
        "crawl_task",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("crawl_run.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("reject_reason", sa.String(80)),
        sa.Column("redirect_chain", JSONB(), nullable=False),
        sa.Column("http_status", sa.Integer()),
        sa.Column("bytes_downloaded", sa.Integer(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("actor", sa.String(120), nullable=False),
        sa.Column("source_id", UUID(as_uuid=True)),
        sa.Column("document_id", UUID(as_uuid=True)),
        sa.Column("detail", JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("ix_audit_event_time", "audit_log", ["event_type", "created_at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("crawl_task")
    op.drop_table("crawl_run")
    op.drop_table("document_version")
    op.drop_index("ix_document_source_status", table_name="document")
    op.drop_table("document")
    op.drop_table("source_domain_rule")
    op.drop_table("source")
