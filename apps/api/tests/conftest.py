"""
Pytest configuration and fixtures for integration tests.
"""

import asyncio
from typing import AsyncGenerator, Generator
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import Base, get_session
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
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

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
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client."""
    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(app=app, base_url="http://test") as client:
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
