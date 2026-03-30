"""
User repository for database operations.
"""

from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User, UserRole
from app.db.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize user repository.

        Args:
            session: Database session
        """
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        """
        Get user by email.

        Args:
            email: User email

        Returns:
            User or None if not found
        """
        normalized_email = email.strip().lower()
        if not normalized_email:
            return None

        result = await self.session.execute(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        """
        Check if email already exists.

        Args:
            email: Email to check

        Returns:
            True if email exists, False otherwise
        """
        user = await self.get_by_email(email)
        return user is not None

    async def get_active_users(self, skip: int = 0, limit: int = 100) -> list[User]:
        """
        Get all active users.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of active users
        """
        result = await self.session.execute(
            select(User).where(User.is_active == True).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def list_with_filters(
        self,
        search: Optional[str] = None,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> tuple[list[User], int]:
        """
        List users with optional filters and pagination.

        Args:
            search: Search term for name or email
            role: Filter by user role
            is_active: Filter by active status
            skip: Records to skip
            limit: Records to return

        Returns:
            Tuple of (users, total_count)
        """
        filters = []

        if search:
            term = f"%{search}%"
            filters.append(or_(User.name.ilike(term), User.email.ilike(term)))

        if role:
            filters.append(User.role == role)

        if is_active is not None:
            filters.append(User.is_active == is_active)

        where_clause = and_(*filters) if filters else None

        count_query = select(func.count()).select_from(User)
        if where_clause is not None:
            count_query = count_query.where(where_clause)
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        query = select(User)
        if where_clause is not None:
            query = query.where(where_clause)

        query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)

        return list(result.scalars().all()), total
