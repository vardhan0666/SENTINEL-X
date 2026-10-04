"""
Async SQLAlchemy engine/session management for SENTINEL-X.

ORM models (app.models.*) are introduced in Batch 2. This module is
intentionally model-agnostic: it only manages the engine, session factory,
and connectivity checks used by the API and the Docker health check.
"""
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a scoped async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_database_connection() -> bool:
    """
    Lightweight connectivity check used by:
      - the Docker container HEALTHCHECK
      - the /api/v1/health endpoint
      - the container entrypoint's startup wait-loop
    """
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False