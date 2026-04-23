"""
Pytest configuration and fixtures for integration tests.
"""

import asyncio
from typing import AsyncGenerator, Generator
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import get_session
from app.core.config import settings
from app.db.models.user import User
from app.core.security import hash_password
from uuid import uuid4


# Test database URL
TEST_DATABASE_URL = "postgresql+asyncpg://contabil:contabil123@localhost:5432/contabil_db_test"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine.

    The test database schema is prepared with Alembic before pytest runs. Using
    metadata.create_all is not enough here because some PostgreSQL enums are
    intentionally owned by migrations.
    """
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    yield engine

    await engine.dispose()


@pytest.fixture(scope="function")
async def session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    TestSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with TestSessionLocal() as session:
        await _truncate_public_tables(session)
        yield session
        await session.rollback()


async def _truncate_public_tables(session: AsyncSession) -> None:
    """Reset test data while preserving the migrated schema and enum types."""
    result = await session.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'alembic_version'
            ORDER BY tablename
            """
        )
    )
    table_names = [row[0] for row in result.fetchall()]
    if not table_names:
        return

    quoted_tables = ", ".join(f'"{table_name}"' for table_name in table_names)
    await session.execute(text(f"TRUNCATE TABLE {quoted_tables} RESTART IDENTITY CASCADE"))
    await session.commit()


@pytest.fixture(scope="function")
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client."""
    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def admin_user(session: AsyncSession) -> User:
    """Create admin test user."""
    user = User(
        id=uuid4(),
        name="Admin Test",
        email="admin@test.com",
        password_hash=hash_password("Admin123!"),
        role="admin",
        is_active=True,
        is_verified=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.fixture(scope="function")
async def func_user(session: AsyncSession) -> User:
    """Create funcionario test user."""
    user = User(
        id=uuid4(),
        name="Func Test",
        email="func@test.com",
        password_hash=hash_password("Func123!"),
        role="func",
        is_active=True,
        is_verified=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.fixture(scope="function")
async def cliente_user(session: AsyncSession) -> User:
    """Create cliente test user."""
    user = User(
        id=uuid4(),
        name="Cliente Test",
        email="cliente@test.com",
        password_hash=hash_password("Cliente123!"),
        role="cliente",
        is_active=True,
        is_verified=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.fixture(scope="function")
async def admin_token(client: AsyncClient, admin_user: User) -> str:
    """Get admin auth token."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "Admin123!"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="function")
async def func_token(client: AsyncClient, func_user: User) -> str:
    """Get func auth token."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "func@test.com", "password": "Func123!"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="function")
async def cliente_token(client: AsyncClient, cliente_user: User) -> str:
    """Get cliente auth token."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "cliente@test.com", "password": "Cliente123!"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]
