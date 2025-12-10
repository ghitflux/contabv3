"""
Integration tests for authentication routes.
"""

import httpx
import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_login_success():
    """Test successful login."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@contabil.com", "password": "Admin123!"}
        )

    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert "token_type" in data
    assert "expires_in" in data
    assert "user" in data

    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@contabil.com"
    assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_incorrect_email():
    """Test login with incorrect email."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrong@example.com", "password": "Admin123!"}
        )

    assert response.status_code == 401
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_login_incorrect_password():
    """Test login with incorrect password."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@contabil.com", "password": "wrongpassword"}
        )

    assert response.status_code == 401
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_get_current_user():
    """Test get current user endpoint."""
    # First, login to get token
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@contabil.com", "password": "Admin123!"}
        )
        access_token = login_response.json()["access_token"]

        # Now get current user
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )

    assert response.status_code == 200
    data = response.json()

    assert data["email"] == "admin@contabil.com"
    assert data["role"] == "admin"
    assert "id" in data
    assert "name" in data


@pytest.mark.asyncio
async def test_get_current_user_without_token():
    """Test get current user without token."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/users/me")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_with_invalid_token():
    """Test get current user with invalid token."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid_token"}
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token():
    """Test refresh token endpoint."""
    # First, login to get tokens
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@contabil.com", "password": "Admin123!"}
        )
        refresh_token = login_response.json()["refresh_token"]

        # Now refresh the token
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )

    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert "token_type" in data
    assert "expires_in" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_token_with_invalid_token():
    """Test refresh token with invalid token."""
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid_token"}
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_with_access_token():
    """Test refresh token endpoint with access token (should fail)."""
    # First, login to get tokens
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@contabil.com", "password": "Admin123!"}
        )
        access_token = login_response.json()["access_token"]

        # Try to refresh with access token (should fail)
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token}
        )

    assert response.status_code == 401
    assert "Invalid token type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_logout():
    """Test logout endpoint."""
    # First, login to get token
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@contabil.com", "password": "Admin123!"}
        )
        access_token = login_response.json()["access_token"]

        # Now logout
        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"}
        )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "message" in data
