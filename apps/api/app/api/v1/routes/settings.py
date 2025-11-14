"""
Settings routes for system and user configuration.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db, require_admin
from app.db.models.user import User
from app.db.repositories.settings import (
    ClientDefaultSettingsRepository,
    SecuritySettingsRepository,
    SystemSettingsRepository,
    UserSettingsRepository,
)
from app.db.models.settings import ClientDefaultSettings, SecuritySettings, SystemSettings, UserSettings
from app.schemas.settings import (
    ClientDefaultSettingsResponse,
    ClientDefaultSettingsUpdate,
    SecuritySettingsResponse,
    SecuritySettingsUpdate,
    SystemSettingsResponse,
    SystemSettingsUpdate,
    UserSettingsResponse,
    UserSettingsUpdate,
)
from app.schemas.base import ResponseSchema

router = APIRouter(prefix="/settings", tags=["settings"])


# ======================== USER SETTINGS ========================


@router.get("/me", response_model=UserSettingsResponse, status_code=status.HTTP_200_OK)
async def get_user_settings(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserSettingsResponse:
    """
    Get current user's settings.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        UserSettingsResponse: User settings data
    """
    settings_repo = UserSettingsRepository(db)
    settings = await settings_repo.get_by_user_id(current_user.id)

    if not settings:
        # Create default settings for user if they don't exist
        settings = UserSettings(user_id=current_user.id)
        settings = await settings_repo.create(settings)
        await db.commit()

    return UserSettingsResponse.model_validate(settings)


@router.put("/me", response_model=UserSettingsResponse, status_code=status.HTTP_200_OK)
async def update_user_settings(
    settings_data: UserSettingsUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserSettingsResponse:
    """
    Update current user's settings.

    Args:
        settings_data: Settings update data
        current_user: Current authenticated user
        db: Database session

    Returns:
        UserSettingsResponse: Updated settings data
    """
    settings_repo = UserSettingsRepository(db)
    settings = await settings_repo.get_by_user_id(current_user.id)

    if not settings:
        settings = UserSettings(user_id=current_user.id)

    # Update fields
    update_data = settings_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings = await settings_repo.update(settings)
    await db.commit()
    await db.refresh(settings)

    return UserSettingsResponse.model_validate(settings)


# ======================== SYSTEM SETTINGS (ADMIN ONLY) ========================


@router.get("/system", response_model=SystemSettingsResponse, status_code=status.HTTP_200_OK)
async def get_system_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> SystemSettingsResponse:
    """
    Get system settings (admin only).

    Args:
        db: Database session
        _: Current user (must be admin)

    Returns:
        SystemSettingsResponse: System settings data
    """
    settings_repo = SystemSettingsRepository(db)
    settings = await settings_repo.get_settings()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="System settings not found"
        )

    return SystemSettingsResponse.model_validate(settings)


@router.put("/system", response_model=SystemSettingsResponse, status_code=status.HTTP_200_OK)
async def update_system_settings(
    settings_data: SystemSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> SystemSettingsResponse:
    """
    Update system settings (admin only).

    Args:
        settings_data: Settings update data
        db: Database session
        _: Current user (must be admin)

    Returns:
        SystemSettingsResponse: Updated settings data
    """
    settings_repo = SystemSettingsRepository(db)
    settings = await settings_repo.get_settings()

    if not settings:
        # Create default settings if they don't exist
        settings = SystemSettings(
            company_name="ContabilConsult",
        )
    else:
        # Update fields
        update_data = settings_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)

    settings = await settings_repo.update(settings)
    await db.commit()
    await db.refresh(settings)

    return SystemSettingsResponse.model_validate(settings)


# ======================== SECURITY SETTINGS (ADMIN ONLY) ========================


@router.get("/security", response_model=SecuritySettingsResponse, status_code=status.HTTP_200_OK)
async def get_security_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> SecuritySettingsResponse:
    """
    Get security settings (admin only).

    Args:
        db: Database session
        _: Current user (must be admin)

    Returns:
        SecuritySettingsResponse: Security settings data
    """
    settings_repo = SecuritySettingsRepository(db)
    settings = await settings_repo.get_settings()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security settings not found"
        )

    return SecuritySettingsResponse.model_validate(settings)


@router.put("/security", response_model=SecuritySettingsResponse, status_code=status.HTTP_200_OK)
async def update_security_settings(
    settings_data: SecuritySettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> SecuritySettingsResponse:
    """
    Update security settings (admin only).

    Args:
        settings_data: Settings update data
        db: Database session
        _: Current user (must be admin)

    Returns:
        SecuritySettingsResponse: Updated settings data
    """
    settings_repo = SecuritySettingsRepository(db)
    settings = await settings_repo.get_settings()

    if not settings:
        # Create default settings if they don't exist
        settings = SecuritySettings()
    else:
        # Update fields
        update_data = settings_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)

    settings = await settings_repo.update(settings)
    await db.commit()
    await db.refresh(settings)

    return SecuritySettingsResponse.model_validate(settings)


# ======================== CLIENT DEFAULT SETTINGS (ADMIN ONLY) ========================


@router.get("/clients/defaults", response_model=ClientDefaultSettingsResponse, status_code=status.HTTP_200_OK)
async def get_client_defaults(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> ClientDefaultSettingsResponse:
    """
    Get default client settings (admin only).

    Args:
        db: Database session
        _: Current user (must be admin)

    Returns:
        ClientDefaultSettingsResponse: Client default settings data
    """
    settings_repo = ClientDefaultSettingsRepository(db)
    settings = await settings_repo.get_settings()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client default settings not found"
        )

    return ClientDefaultSettingsResponse.model_validate(settings)


@router.put("/clients/defaults", response_model=ClientDefaultSettingsResponse, status_code=status.HTTP_200_OK)
async def update_client_defaults(
    settings_data: ClientDefaultSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> ClientDefaultSettingsResponse:
    """
    Update default client settings (admin only).

    Args:
        settings_data: Settings update data
        db: Database session
        _: Current user (must be admin)

    Returns:
        ClientDefaultSettingsResponse: Updated settings data
    """
    settings_repo = ClientDefaultSettingsRepository(db)
    settings = await settings_repo.get_settings()

    if not settings:
        # Create default settings if they don't exist
        settings = ClientDefaultSettings()
    else:
        # Update fields
        update_data = settings_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(settings, field, value)

    settings = await settings_repo.update(settings)
    await db.commit()
    await db.refresh(settings)

    return ClientDefaultSettingsResponse.model_validate(settings)
