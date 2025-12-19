"""
Database configuration with SQLAlchemy 2 async.
Supports write/read engines for future read replicas.
"""

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool, QueuePool

from app.core.config import settings

# Declarative Base
Base = declarative_base()


class DatabaseManager:
    """Manages database engines and sessions."""

    def __init__(self) -> None:
        """Initialize database engines."""
        self._write_engine: AsyncEngine | None = None
        self._read_engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    def _create_engine(self, url: str, **kwargs: Any) -> AsyncEngine:
        """Create async engine with connection pool."""
        pool_class = NullPool if settings.DEBUG else QueuePool

        engine_kwargs: dict[str, Any] = {
            "echo": settings.DB_ECHO,
            "poolclass": pool_class,
            **kwargs,
        }

        # Only add pool parameters when NOT using NullPool
        if not settings.DEBUG:
            engine_kwargs.update({
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
                "pool_timeout": settings.DB_POOL_TIMEOUT,
                "pool_recycle": settings.DB_POOL_RECYCLE,
                "pool_pre_ping": True,
            })

        return create_async_engine(url, **engine_kwargs)

    @property
    def write_engine(self) -> AsyncEngine:
        """Get or create write engine."""
        if self._write_engine is None:
            self._write_engine = self._create_engine(str(settings.DATABASE_WRITE_URL))
        return self._write_engine

    @property
    def read_engine(self) -> AsyncEngine:
        """Get or create read engine."""
        if self._read_engine is None:
            self._read_engine = self._create_engine(str(settings.DATABASE_READ_URL))
        return self._read_engine

    @property
    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        """Get or create session factory."""
        if self._session_factory is None:
            self._session_factory = async_sessionmaker(
                bind=self.write_engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
                autocommit=False,
            )
        return self._session_factory

    async def close(self) -> None:
        """Close all database connections."""
        if self._write_engine:
            await self._write_engine.dispose()
        if self._read_engine and self._read_engine != self._write_engine:
            await self._read_engine.dispose()

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Get async database session.
        Used as FastAPI dependency.
        """
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


# Global database manager instance
db_manager = DatabaseManager()


# Dependency for FastAPI
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database session."""
    async for session in db_manager.get_session():
        yield session


# Backward compatibility for older imports (tests)
get_session = get_db
