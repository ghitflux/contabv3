"""
Settings repositories for database operations.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.settings import ClientDefaultSettings, SecuritySettings, SystemSettings, UserSettings
from app.db.repositories.base import BaseRepository


class SystemSettingsRepository(BaseRepository[SystemSettings]):
    """Repository for SystemSettings model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize system settings repository.

        Args:
            session: Database session
        """
        super().__init__(SystemSettings, session)

    async def get_settings(self) -> SystemSettings | None:
        """
        Get the single system settings record.

        Returns:
            SystemSettings instance or None if not found
        """
        result = await self.session.execute(
            select(SystemSettings).limit(1)
        )
        return result.scalar_one_or_none()


class UserSettingsRepository(BaseRepository[UserSettings]):
    """Repository for UserSettings model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize user settings repository.

        Args:
            session: Database session
        """
        super().__init__(UserSettings, session)

    async def get_by_user_id(self, user_id: UUID) -> UserSettings | None:
        """
        Get user settings by user ID.

        Args:
            user_id: User UUID

        Returns:
            UserSettings instance or None if not found
        """
        result = await self.session.execute(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def user_settings_exists(self, user_id: UUID) -> bool:
        """
        Check if user settings exist.

        Args:
            user_id: User UUID

        Returns:
            True if settings exist, False otherwise
        """
        settings = await self.get_by_user_id(user_id)
        return settings is not None


class SecuritySettingsRepository(BaseRepository[SecuritySettings]):
    """Repository for SecuritySettings model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize security settings repository.

        Args:
            session: Database session
        """
        super().__init__(SecuritySettings, session)

    async def get_settings(self) -> SecuritySettings | None:
        """
        Get the single security settings record.

        Returns:
            SecuritySettings instance or None if not found
        """
        result = await self.session.execute(
            select(SecuritySettings).limit(1)
        )
        return result.scalar_one_or_none()


class ClientDefaultSettingsRepository(BaseRepository[ClientDefaultSettings]):
    """Repository for ClientDefaultSettings model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize client default settings repository.

        Args:
            session: Database session
        """
        super().__init__(ClientDefaultSettings, session)

    async def get_settings(self) -> ClientDefaultSettings | None:
        """
        Get the single client default settings record.

        Returns:
            ClientDefaultSettings instance or None if not found
        """
        result = await self.session.execute(
            select(ClientDefaultSettings).limit(1)
        )
        return result.scalar_one_or_none()
