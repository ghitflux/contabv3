"""
Authentication service with business logic.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_tokens, decode_token
from app.db.models.user import User
from app.db.repositories.user import UserRepository
from app.schemas.auth import RefreshResponse, TokenResponse
from app.schemas.user import UserResponse
from app.services.security import enforce_password_policy

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize auth service.

        Args:
            session: Database session
        """
        self.session = session
        self.user_repo = UserRepository(session)

    async def authenticate(self, email: str, password: str) -> User:
        """
        Authenticate user with email and password.

        Args:
            email: User email
            password: Plain text password

        Returns:
            Authenticated user

        Raises:
            HTTPException: If authentication fails
        """
        # Get user by email
        user = await self.user_repo.get_by_email(email)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify password
        if not user.verify_password(password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user",
            )

        return user

    async def login(self, email: str, password: str) -> TokenResponse:
        """
        Login user and create tokens.

        Args:
            email: User email
            password: Plain text password

        Returns:
            Token response with access and refresh tokens

        Raises:
            HTTPException: If authentication fails
        """
        # Authenticate user
        user = await self.authenticate(email, password)

        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(user)

        # Create tokens
        tokens = create_tokens(str(user.id), user.role.value)

        # Create response
        return TokenResponse(
            **tokens,
            user=UserResponse.model_validate(user)
        )

    async def refresh_access_token(self, refresh_token: str) -> RefreshResponse:
        """
        Refresh access token using refresh token.

        Args:
            refresh_token: JWT refresh token

        Returns:
            New access token

        Raises:
            HTTPException: If refresh token is invalid
        """
        try:
            # Decode refresh token
            payload = decode_token(refresh_token)

            # Verify it's a refresh token
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Get user ID and role
            user_id_str: str | None = payload.get("sub")
            role: str | None = payload.get("role")

            if not user_id_str or not role:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Verify user still exists and is active
            user_id = UUID(user_id_str)
            user = await self.user_repo.get_by_id(user_id)

            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Create new tokens
            tokens = create_tokens(str(user.id), user.role.value)

            return RefreshResponse(
                access_token=tokens["access_token"],
                token_type=tokens["token_type"],
                expires_in=tokens["expires_in"],
            )

        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired refresh token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID in token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e

    async def logout(self, user: User) -> dict[str, Any]:
        """
        Logout user (optional - mainly for audit logging).

        Args:
            user: Current user

        Returns:
            Success message
        """
        # In a JWT-based system, logout is typically handled client-side
        # by discarding the tokens. Here we can do audit logging if needed.

        return {
            "success": True,
            "message": "Successfully logged out"
        }

    async def request_password_reset(self, email: str) -> str | None:
        """
        Generate a password reset token for the given email.

        Args:
            email: User email requesting reset

        Returns:
            Reset token if user exists and is active, otherwise None
        """
        user = await self.user_repo.get_by_email(email)

        if not user or not user.is_active:
            logger.info("Password reset requested for unknown or inactive account: %s", email)
            return None

        token = create_access_token(
            {
                "sub": str(user.id),
                "role": user.role.value,
                "type": "password_reset",
            },
            expires_delta=timedelta(hours=1),
        )

        logger.info("Password reset token generated for user %s", email)
        return token

    async def confirm_password_reset(self, token: str, new_password: str) -> None:
        """
        Validate a password reset token and set the new password.

        Args:
            token: Reset token sent to the user
            new_password: New password to apply
        """
        try:
            payload = decode_token(token)
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token",
            ) from e

        if payload.get("type") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token type",
            )

        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token payload",
            )

        try:
            user_id = UUID(user_id_str)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user in password reset token",
            ) from e

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or inactive user for password reset",
            )

        await enforce_password_policy(self.session, new_password)

        user.set_password(new_password)
        await self.user_repo.update(user)
        await self.session.commit()

        logger.info("Password reset completed for user %s", user.email)
