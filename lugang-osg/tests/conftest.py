# 鲁港通 - 测试公共配置：让 PG 专用类型（JSONB/UUID）可在 SQLite 内存库编译，
# 使 models 全套建表可用于导入器/pipeline/探测工具集成测试（不发真实网络）。
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):  # noqa: ANN001
    return "JSON"


@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):  # noqa: ANN001
    return "CHAR(36)"


# 鲁港通 - 共享 db fixture：原仅 test_ingest 私有，探测工具测试同样需要，故上移 conftest
@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)
