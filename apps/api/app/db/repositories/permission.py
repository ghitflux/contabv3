"""
Permission repositories for database operations.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.permission import Permission, RolePermission
from app.db.repositories.base import BaseRepository


class PermissionRepository(BaseRepository[Permission]):
    """Repository for Permission model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize permission repository.

        Args:
            session: Database session
        """
        super().__init__(Permission, session)

    async def get_by_code(self, code: str) -> Permission | None:
        """
        Get permission by code.

        Args:
            code: Permission code

        Returns:
            Permission instance or None if not found
        """
        result = await self.session.execute(
            select(Permission).where(Permission.code == code)
        )
        return result.scalar_one_or_none()

    async def code_exists(self, code: str) -> bool:
        """
        Check if permission code already exists.

        Args:
            code: Permission code

        Returns:
            True if code exists, False otherwise
        """
        permission = await self.get_by_code(code)
        return permission is not None

    async def get_by_category(self, category: str, skip: int = 0, limit: int = 100) -> list[Permission]:
        """
        Get permissions by category.

        Args:
            category: Permission category
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Permission instances
        """
        result = await self.session.execute(
            select(Permission)
            .where(Permission.category == category)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())


class RolePermissionRepository(BaseRepository[RolePermission]):
    """Repository for RolePermission model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize role permission repository.

        Args:
            session: Database session
        """
        super().__init__(RolePermission, session)

    async def get_by_role(self, role: str) -> list[RolePermission]:
        """
        Get all permissions for a role.

        Args:
            role: Role name (admin, func, cliente)

        Returns:
            List of RolePermission instances
        """
        result = await self.session.execute(
            select(RolePermission).where(RolePermission.role == role)
        )
        return list(result.scalars().all())

    async def get_by_role_and_permission(self, role: str, permission_id: UUID) -> RolePermission | None:
        """
        Get specific role permission.

        Args:
            role: Role name
            permission_id: Permission UUID

        Returns:
            RolePermission instance or None if not found
        """
        result = await self.session.execute(
            select(RolePermission).where(
                (RolePermission.role == role) & (RolePermission.permission_id == permission_id)
            )
        )
        return result.scalar_one_or_none()

    async def has_permission(self, role: str, permission_code: str) -> bool:
        """
        Check if role has permission.

        Args:
            role: Role name
            permission_code: Permission code

        Returns:
            True if role has permission, False otherwise
        """
        result = await self.session.execute(
            select(RolePermission).join(
                Permission, RolePermission.permission_id == Permission.id
            ).where(
                (RolePermission.role == role) &
                (Permission.code == permission_code) &
                (RolePermission.granted == True)
            )
        )
        return result.scalar_one_or_none() is not None
