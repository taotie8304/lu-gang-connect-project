# 鲁港通 - SQLAlchemy 引擎与会话（仅内网服务使用，不直接对公网暴露）
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()

engine = create_engine(
    _settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    # 鲁港通 - FastAPI 依赖：每请求一会话，异常回滚
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
