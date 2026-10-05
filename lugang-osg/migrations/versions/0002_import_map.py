"""import_map：FastGPT 导入映射（design.md §7.3.5）

Revision ID: 0002_import_map
Revises: 0001_initial
Create Date: 2026-09-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# 鲁港通 - revision identifiers
revision: str = "0002_import_map"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "import_map",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("document.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("dataset_id", sa.Text(), nullable=False),
        sa.Column("collection_id", sa.Text()),
        sa.Column("version_id", UUID(as_uuid=True)),
        sa.Column("content_sha256", sa.CHAR(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("ix_import_map_status", "import_map", ["status"])
    op.create_index("ix_import_map_sha", "import_map", ["content_sha256"])


def downgrade() -> None:
    op.drop_index("ix_import_map_sha", table_name="import_map")
    op.drop_index("ix_import_map_status", table_name="import_map")
    op.drop_table("import_map")
