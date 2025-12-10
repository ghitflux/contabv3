"""
Authentication routes.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RefreshResponse,
    TokenResponse,
)
from app.schemas.base import ResponseSchema
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    credentials: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Login with email and password.

    Args:
        credentials: Login credentials (email and password)
        db: Database session

    Returns:
        TokenResponse: Access token, refresh token, and user info

    Raises:
        HTTPException: 401 if credentials are invalid
    """
    auth_service = AuthService(db)
    return await auth_service.login(credentials.email, credentials.password)


@router.post("/login/form", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login_form(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Login with OAuth2 form (for compatibility with OAuth2PasswordBearer).

    Args:
        form_data: OAuth2 form data (username = email, password)
        db: Database session

    Returns:
        TokenResponse: Access token, refresh token, and user info

    Raises:
        HTTPException: 401 if credentials are invalid
    """
    auth_service = AuthService(db)
    # OAuth2 form uses 'username' field, but we expect email
    return await auth_service.login(form_data.username, form_data.password)


@router.post("/refresh", response_model=RefreshResponse, status_code=status.HTTP_200_OK)
async def refresh_token(
    request: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RefreshResponse:
    """
    Refresh access token using refresh token.

    Args:
        request: Refresh token request
        db: Database session

    Returns:
        RefreshResponse: New access token

    Raises:
        HTTPException: 401 if refresh token is invalid or expired
    """
    auth_service = AuthService(db)
    return await auth_service.refresh_access_token(request.refresh_token)


@router.post("/logout", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def logout(
    request: LogoutRequest | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ResponseSchema:
    """
    Logout current user.

    Note: In JWT-based auth, logout is typically handled client-side
    by discarding tokens. This endpoint is mainly for audit logging.

    Args:
        request: Optional logout request
        current_user: Current authenticated user
        db: Database session

    Returns:
        ResponseSchema: Success message
    """
    auth_service = AuthService(db)
    result = await auth_service.logout(current_user)
    return ResponseSchema(**result)


@router.post("/password-reset", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def request_password_reset(
    request: PasswordResetRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseSchema:
    """
    Request a password reset token. A stubbed token is returned for development.

    Args:
        request: Password reset request with user email
        db: Database session
    """
    auth_service = AuthService(db)
    token = await auth_service.request_password_reset(request.email)

    # In production, this would be emailed. We return it to ease development/testing.
    return ResponseSchema(
        success=True,
        message="If the email is registered, reset instructions have been sent.",
        data={"reset_token": token} if token else None,
    )


@router.post("/password-reset/confirm", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    request: PasswordResetConfirm,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseSchema:
    """
    Confirm password reset with token and new password.

    Args:
        request: Reset confirmation payload
        db: Database session
    """
    auth_service = AuthService(db)
    await auth_service.confirm_password_reset(request.token, request.new_password)

    return ResponseSchema(
        success=True,
        message="Password reset successfully"
    )
