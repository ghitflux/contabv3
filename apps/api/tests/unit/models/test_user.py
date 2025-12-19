"""
Unit tests for User model.
"""

import pytest
from uuid import uuid4

from app.db.models.user import User, UserRole


def test_user_creation():
    """Test basic user creation."""
    user = User(
        id=uuid4(),
        name="Test User",
        email="test@example.com",
        role=UserRole.FUNC,
        is_active=True,
        is_verified=False,
    )

    assert user.name == "Test User"
    assert user.email == "test@example.com"
    assert user.role == UserRole.FUNC
    assert user.is_active is True
    assert user.is_verified is False


def test_user_set_password():
    """Test password hashing."""
    user = User(
        name="Test User",
        email="test@example.com",
        role=UserRole.FUNC,
    )

    password = "testpassword123"
    user.set_password(password)

    # Password should be hashed
    assert user.password_hash is not None
    assert user.password_hash != password
    assert len(user.password_hash) > 0


def test_user_verify_password_correct():
    """Test password verification with correct password."""
    user = User(
        name="Test User",
        email="test@example.com",
        role=UserRole.FUNC,
    )

    password = "testpassword123"
    user.set_password(password)

    # Correct password should verify
    assert user.verify_password(password) is True


def test_user_verify_password_incorrect():
    """Test password verification with incorrect password."""
    user = User(
        name="Test User",
        email="test@example.com",
        role=UserRole.FUNC,
    )

    user.set_password("correctpassword")

    # Incorrect password should not verify
    assert user.verify_password("wrongpassword") is False


def test_user_roles():
    """Test all user roles."""
    # Admin user
    admin = User(
        name="Admin",
        email="admin@example.com",
        role=UserRole.ADMIN,
    )
    assert admin.role == UserRole.ADMIN

    # Func user
    func = User(
        name="Func",
        email="func@example.com",
        role=UserRole.FUNC,
    )
    assert func.role == UserRole.FUNC

    # Cliente user
    cliente = User(
        name="Cliente",
        email="cliente@example.com",
        role=UserRole.CLIENTE,
    )
    assert cliente.role == UserRole.CLIENTE


def test_user_repr():
    """Test user string representation."""
    user = User(
        name="Test User",
        email="test@example.com",
        role=UserRole.FUNC,
    )

    assert repr(user) == "<User test@example.com>"


def test_user_password_different_each_time():
    """Test that same password produces different hashes."""
    user1 = User(
        name="User 1",
        email="user1@example.com",
        role=UserRole.FUNC,
    )
    user2 = User(
        name="User 2",
        email="user2@example.com",
        role=UserRole.FUNC,
    )

    password = "samepassword123"
    user1.set_password(password)
    user2.set_password(password)

    # Same password should produce different hashes (due to different salts)
    assert user1.password_hash != user2.password_hash

    # But both should verify correctly
    assert user1.verify_password(password) is True
    assert user2.verify_password(password) is True
