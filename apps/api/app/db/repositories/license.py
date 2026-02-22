"""
License repository for database operations.
"""

from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import String, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.client import Client
from app.db.models.license import License
from app.db.models.license_event import LicenseEvent
from app.db.repositories.base import BaseRepository
from app.schemas.license import LicenseEventType, LicenseStatus, LicenseType


class LicenseRepository(BaseRepository[License]):
    """Repository for License model operations."""

    def __init__(self, session: AsyncSession):
        """
        Initialize license repository.

        Args:
            session: Database session
        """
        super().__init__(License, session)

    async def list_with_filters(
        self,
        query: Optional[str] = None,
        license_type: Optional[LicenseType] = None,
        status: Optional[LicenseStatus] = None,
        client_id: Optional[UUID] = None,
        include_deleted: bool = True,
        deleted_only: bool = False,
        skip: int = 0,
        limit: int = 10,
    ) -> tuple[list[License], int]:
        """
        List licenses with filters and pagination.

        Args:
            query: Search term for company, CNPJ, registration_number, issuing_authority, or license type
            license_type: Filter by license type
            status: Filter by status
            client_id: Filter by client ID
            include_deleted: Include canceled/expired licenses
            deleted_only: Return only canceled/expired licenses
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            Tuple of (licenses list, total count)
        """
        filters = []

        # Always ignore soft-deleted clients in listings
        filters.append(Client.deleted_at.is_(None))

        # Trash behavior (licenses "in trash" are canceled or expired)
        trash_statuses = (LicenseStatus.CANCELADA, LicenseStatus.VENCIDA)
        if deleted_only:
            filters.append(License.status.in_(trash_statuses))
        elif not include_deleted:
            filters.append(License.status.notin_(trash_statuses))

        # Apply search query
        if query:
            search_term = f"%{query}%"
            filters.append(
                or_(
                    Client.razao_social.ilike(search_term),
                    Client.nome_fantasia.ilike(search_term),
                    Client.cnpj.ilike(search_term),
                    License.registration_number.ilike(search_term),
                    License.issuing_authority.ilike(search_term),
                    License.license_type.cast(String).ilike(search_term),
                )
            )

        # Apply license_type filter
        if license_type:
            filters.append(License.license_type == license_type)

        # Apply status filter
        if status:
            filters.append(License.status == status)

        # Apply client_id filter
        if client_id:
            filters.append(License.client_id == client_id)

        # Count query
        count_query = (
            select(func.count())
            .select_from(License)
            .join(Client, License.client_id == Client.id)
        )
        if filters:
            count_query = count_query.where(and_(*filters))
        total_result = await self.session.execute(count_query)
        total = total_result.scalar_one()

        # Data query with pagination
        data_query = (
            select(License)
            .join(Client, License.client_id == Client.id)
            .options(selectinload(License.client))
        )
        if filters:
            data_query = data_query.where(and_(*filters))
        data_query = (
            data_query
            .order_by(License.expiration_date.asc().nulls_last(), License.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(data_query)
        licenses = list(result.scalars().all())

        return licenses, total

    async def get_by_client(self, client_id: UUID) -> list[License]:
        """
        Get all licenses for a client.

        Args:
            client_id: Client ID

        Returns:
            List of licenses
        """
        result = await self.session.execute(
            select(License)
            .where(License.client_id == client_id)
            .order_by(License.expiration_date.asc().nulls_last())
        )
        return list(result.scalars().all())

    async def get_by_id_with_relations(self, license_id: UUID) -> Optional[License]:
        """Get license by ID with related client eagerly loaded."""
        result = await self.session.execute(
            select(License)
            .where(License.id == license_id)
            .options(selectinload(License.client))
        )
        return result.scalar_one_or_none()

    async def get_expiring_soon(self, days: int = 30) -> list[License]:
        """
        Get licenses expiring within specified days.

        Args:
            days: Number of days to look ahead (default: 30)

        Returns:
            List of licenses expiring soon
        """
        today = date.today()
        expiration_cutoff = today + timedelta(days=days)

        result = await self.session.execute(
            select(License)
            .where(
                and_(
                    License.expiration_date.isnot(None),
                    License.expiration_date >= today,
                    License.expiration_date <= expiration_cutoff,
                    License.status.in_([LicenseStatus.ATIVA, LicenseStatus.PENDENTE_RENOVACAO]),
                )
            )
            .order_by(License.expiration_date.asc())
        )
        return list(result.scalars().all())

    async def get_expired(self) -> list[License]:
        """
        Get all expired licenses.

        Returns:
            List of expired licenses
        """
        today = date.today()
        result = await self.session.execute(
            select(License)
            .where(
                and_(
                    License.expiration_date.isnot(None),
                    License.expiration_date < today,
                    License.status != LicenseStatus.CANCELADA,
                )
            )
            .order_by(License.expiration_date.desc())
        )
        return list(result.scalars().all())

    async def add_event(
        self,
        license_id: UUID,
        event_type: LicenseEventType,
        description: str,
        user_id: Optional[UUID] = None,
    ) -> LicenseEvent:
        """
        Add an event to a license.

        Args:
            license_id: License ID
            event_type: Event type
            description: Event description
            user_id: Optional user ID who triggered the event

        Returns:
            Created LicenseEvent
        """
        event = LicenseEvent(
            license_id=license_id,
            event_type=event_type,
            description=description,
            user_id=user_id,
        )
        self.session.add(event)
        await self.session.flush()
        await self.session.refresh(event)
        return event

    async def get_events(self, license_id: UUID) -> list[LicenseEvent]:
        """
        Get all events for a license.

        Args:
            license_id: License ID

        Returns:
            List of license events
        """
        result = await self.session.execute(
            select(LicenseEvent)
            .where(LicenseEvent.license_id == license_id)
            .order_by(LicenseEvent.created_at.desc())
        )
        return list(result.scalars().all())
