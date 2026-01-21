"""
Dependencies for API endpoints.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.security import decode_token
from app.db.models.user import User, UserRole
from app.schemas.auth import TokenData

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_db() -> AsyncSession:
    """
    Dependency to get database session.

    Yields:
        AsyncSession: Database session
    """
    async with db_manager.session_factory() as session:
        yield session


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Get current authenticated user from token.

    Args:
        token: JWT token from Authorization header
        db: Database session

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(sub=user_id, role=payload.get("role", ""))
    except JWTError:
        raise credentials_exception

    # Get user from database
    try:
        user_uuid = UUID(token_data.sub)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Get current active user.

    Args:
        current_user: Current authenticated user

    Returns:
        User: Current active user

    Raises:
        HTTPException: If user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def require_role(allowed_roles: list[UserRole]):
    """
    Dependency factory to require specific roles.

    Args:
        allowed_roles: List of allowed roles

    Returns:
        Dependency function that checks user role

    Example:
        @app.get("/admin")
        async def admin_endpoint(user: User = Depends(require_role([UserRole.ADMIN]))):
            ...
    """
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        """Check if user has required role."""
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user.role.value}' not authorized. Required: {[r.value for r in allowed_roles]}"
            )
        return current_user

    return role_checker


def require_admin():
    """
    Dependency to require admin or funcionario role.

    Returns:
        Dependency function that checks for admin or func role
    """
    return require_role([UserRole.ADMIN, UserRole.FUNC])


def require_admin_or_func():
    """
    Dependency to require admin or funcionario role.

    Returns:
        Dependency function that checks for admin or func role
    """
    return require_role([UserRole.ADMIN, UserRole.FUNC])


async def get_optional_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Annotated[AsyncSession, Depends(get_db)] | None = None,
) -> User | None:
    """
    Get current user if token is provided, otherwise return None.
    Useful for endpoints that work with or without authentication.

    Args:
        token: Optional JWT token
        db: Database session

    Returns:
        User or None: Current user if authenticated, None otherwise
    """
    if token is None or db is None:
        return None

    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None
