"""
Unit tests for security module.
"""

from datetime import timedelta

import pytest
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_tokens,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_password():
    """Test password hashing."""
    password = "testpassword123"
    hashed = hash_password(password)

    assert hashed is not None
    assert hashed != password
    assert len(hashed) > 0
    assert hashed.startswith("$2b$")  # bcrypt hash starts with $2b$


def test_hash_password_different_each_time():
    """Test that same password produces different hashes."""
    password = "testpassword123"
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    assert hash1 != hash2  # Different salts produce different hashes


def test_verify_password_correct():
    """Test password verification with correct password."""
    password = "testpassword123"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_verify_password_incorrect():
    """Test password verification with incorrect password."""
    password = "testpassword123"
    hashed = hash_password(password)

    assert verify_password("wrongpassword", hashed) is False


def test_create_access_token():
    """Test access token creation."""
    data = {"sub": "user123", "role": "admin"}
    token = create_access_token(data)

    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0

    # Decode and verify payload
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "user123"
    assert payload["role"] == "admin"
    assert "exp" in payload
    assert "iat" in payload


def test_create_access_token_with_custom_expiry():
    """Test access token creation with custom expiry."""
    data = {"sub": "user123"}
    expires_delta = timedelta(minutes=15)
    token = create_access_token(data, expires_delta=expires_delta)

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert "exp" in payload


def test_create_refresh_token():
    """Test refresh token creation."""
    data = {"sub": "user123", "role": "admin"}
    token = create_refresh_token(data)

    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0

    # Decode and verify payload
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "user123"
    assert payload["role"] == "admin"
    assert payload["type"] == "refresh"
    assert "exp" in payload
    assert "iat" in payload


def test_create_refresh_token_with_custom_expiry():
    """Test refresh token creation with custom expiry."""
    data = {"sub": "user123"}
    expires_delta = timedelta(days=14)
    token = create_refresh_token(data, expires_delta=expires_delta)

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert "exp" in payload
    assert payload["type"] == "refresh"


def test_decode_token_valid():
    """Test decoding a valid token."""
    data = {"sub": "user123", "role": "admin"}
    token = create_access_token(data)

    decoded = decode_token(token)
    assert decoded["sub"] == "user123"
    assert decoded["role"] == "admin"


def test_decode_token_invalid():
    """Test decoding an invalid token."""
    invalid_token = "invalid.token.here"

    with pytest.raises(JWTError):
        decode_token(invalid_token)


def test_decode_token_tampered():
    """Test decoding a tampered token."""
    data = {"sub": "user123", "role": "admin"}
    token = create_access_token(data)

    # Tamper with token
    tampered_token = token[:-10] + "tampered123"

    with pytest.raises(JWTError):
        decode_token(tampered_token)


def test_create_tokens():
    """Test creating both access and refresh tokens."""
    user_id = "user123"
    role = "admin"

    tokens = create_tokens(user_id, role)

    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert "token_type" in tokens
    assert "expires_in" in tokens

    assert tokens["token_type"] == "bearer"
    assert isinstance(tokens["expires_in"], int)

    # Verify access token
    access_payload = jwt.decode(
        tokens["access_token"],
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM]
    )
    assert access_payload["sub"] == user_id
    assert access_payload["role"] == role

    # Verify refresh token
    refresh_payload = jwt.decode(
        tokens["refresh_token"],
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM]
    )
    assert refresh_payload["sub"] == user_id
    assert refresh_payload["role"] == role
    assert refresh_payload["type"] == "refresh"


def test_password_hash_and_verify_integration():
    """Integration test for password hashing and verification."""
    passwords = ["password123", "P@ssw0rd!", "very_long_password_123456789"]

    for password in passwords:
        hashed = hash_password(password)

        # Correct password should verify
        assert verify_password(password, hashed) is True

        # Incorrect password should not verify
        assert verify_password(password + "wrong", hashed) is False


def test_tokens_decode_correctly():
    """Test that tokens decode to correct user data."""
    user_id = "user123"
    role = "admin"

    tokens = create_tokens(user_id, role)

    # Access token should decode correctly
    access_payload = decode_token(tokens["access_token"])
    assert access_payload["sub"] == user_id
    assert access_payload["role"] == role

    # Refresh token should decode correctly
    refresh_payload = decode_token(tokens["refresh_token"])
    assert refresh_payload["sub"] == user_id
    assert refresh_payload["role"] == role
    assert refresh_payload["type"] == "refresh"
