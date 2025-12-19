"""
User routes.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import (
    get_current_active_user,
    get_db,
    require_admin,
    require_admin_or_func,
)
from app.db.models.user import User, UserRole
from app.db.repositories.user import UserRepository
from app.schemas.base import ResponseSchema
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserUpdatePassword
from app.services.security import enforce_password_policy

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=dict, status_code=status.HTTP_200_OK)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
    search: Optional[str] = Query(None, description="Search by name or email"),
    q: Optional[str] = Query(None, include_in_schema=False),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
    skip: Optional[int] = Query(None, ge=0, description="Skip items (overrides page)"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Limit items (overrides size)"),
) -> dict:
    """
    List users with pagination and filters (admin only).

    Args:
        db: Database session
        _: Current admin user
        search: Search term for name or email
        role: Filter by role
        is_active: Filter by active status
        page: Page number (1-indexed)
        size: Page size
        skip: Items to skip (overrides page)
        limit: Limit (overrides size)

    Returns:
        Paginated list of users
    """
    user_repo = UserRepository(db)

    effective_limit = limit if limit is not None else size
    effective_skip = skip if skip is not None else (page - 1) * effective_limit
    calculated_page = (effective_skip // effective_limit) + 1 if effective_limit else page

    search_term = search or q

    users, total = await user_repo.list_with_filters(
        search=search_term,
        role=role,
        is_active=is_active,
        skip=effective_skip,
        limit=effective_limit,
    )

    pages = (total + effective_limit - 1) // effective_limit if effective_limit else 0

    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": calculated_page,
        "size": effective_limit,
        "pages": pages,
    }


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> UserResponse:
    """
    Get current user information.

    Args:
        current_user: Current authenticated user

    Returns:
        UserResponse: Current user data
    """
    return UserResponse.model_validate(current_user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> UserResponse:
    """
    Create a new user (admin only).

    Args:
        user_data: User creation data
        db: Database session
        _: Current user (must be admin)

    Returns:
        UserResponse: Created user data

    Raises:
        HTTPException: 409 if email already exists
    """
    user_repo = UserRepository(db)

    # Check if email already exists
    if await user_repo.email_exists(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
        detail="Email already registered"
    )

    # Validate password against security policy
    await enforce_password_policy(db, user_data.password)

    # Create new user
    user = User(
        name=user_data.name,
        email=user_data.email,
        role=user_data.role,
        is_active=True,
        is_verified=False,
    )
    user.set_password(user_data.password)

    user = await user_repo.create(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> UserResponse:
    """
    Get user by ID (admin or func only).

    Args:
        user_id: User UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        UserResponse: User data

    Raises:
        HTTPException: 404 if user not found
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """
    Update user (admin or self only).

    Args:
        user_id: User UUID
        user_data: User update data
        db: Database session
        current_user: Current authenticated user

    Returns:
        UserResponse: Updated user data

    Raises:
        HTTPException: 403 if not authorized, 404 if user not found
    """
    user_repo = UserRepository(db)

    # Get user to update
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check authorization (admin or self)
    is_admin = current_user.role == UserRole.ADMIN
    is_self = current_user.id == user_id

    if not (is_admin or is_self):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user"
        )

    # If not admin, can only update own name and email
    if not is_admin:
        if user_data.role is not None or user_data.is_active is not None or user_data.is_verified is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can update role, active status, or verified status"
            )

    # Update fields
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.email is not None:
        # Check if new email already exists
        if user_data.email != user.email and await user_repo.email_exists(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        user.email = user_data.email
    if user_data.role is not None and is_admin:
        user.role = user_data.role
    if user_data.is_active is not None and is_admin:
        user.is_active = user_data.is_active
    if user_data.is_verified is not None and is_admin:
        user.is_verified = user_data.is_verified

    user = await user_repo.update(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.put("/me/password", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def update_own_password(
    password_data: UserUpdatePassword,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> ResponseSchema:
    """
    Update own password.

    Args:
        password_data: Password update data
        db: Database session
        current_user: Current authenticated user

    Returns:
        ResponseSchema: Success message

    Raises:
        HTTPException: 401 if current password is incorrect
    """
    # Verify current password
    if not current_user.verify_password(password_data.current_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )

    # Set new password
    await enforce_password_policy(db, password_data.new_password)
    current_user.set_password(password_data.new_password)

    user_repo = UserRepository(db)
    await user_repo.update(current_user)
    await db.commit()

    return ResponseSchema(
        success=True,
        message="Password updated successfully"
    )


@router.delete("/{user_id}", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> ResponseSchema:
    """
    Delete user (admin only).

    Note: This is a hard delete. Consider implementing soft delete in production.

    Args:
        user_id: User UUID
        db: Database session
        _: Current user (must be admin)

    Returns:
        ResponseSchema: Success message

    Raises:
        HTTPException: 404 if user not found
    """
    user_repo = UserRepository(db)

    deleted = await user_repo.delete(user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.commit()

    return ResponseSchema(
        success=True,
        message="User deleted successfully"
    )
