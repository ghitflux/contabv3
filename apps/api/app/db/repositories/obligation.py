"""Obligation Repository - Data access layer for obligations."""

from datetime import datetime
from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.client import Client
from app.db.models.obligation import Obligation, ObligationStatus
from app.db.repositories.base import BaseRepository

_UNSET = object()


class ObligationRepository(BaseRepository[Obligation]):
    """Repository for Obligation operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Obligation, db)

    async def get_by_id_with_relations(
        self,
        obligation_id: UUID,
        include_deleted: bool = False,
    ) -> Optional[Obligation]:
        """Get obligation with all relationships loaded."""
        conditions = [Obligation.id == obligation_id]
        if not include_deleted:
            conditions.append(Obligation.deleted_at.is_(None))

        stmt = (
            select(Obligation)
            .where(and_(*conditions))
            .options(
                selectinload(Obligation.obligation_type),
                selectinload(Obligation.client),
                selectinload(Obligation.events),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_with_filters(
        self,
        client_id: Optional[UUID] = None,
        status: Optional[ObligationStatus] = None,
        year: Optional[int] = None,
        month: Optional[int] = None,
        include_deleted: bool = False,
        deleted_only: bool = False,
        category: Optional[str] = None,
        office_client_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Obligation], int]:
        """List obligations with optional filters and deletion controls."""
        conditions = []

        if deleted_only:
            conditions.append(Obligation.deleted_at.is_not(None))
        elif not include_deleted:
            conditions.append(Obligation.deleted_at.is_(None))

        if client_id:
            conditions.append(Obligation.client_id == client_id)

        if category == "office":
            if office_client_id:
                conditions.append(Obligation.client_id == office_client_id)
            else:
                return [], 0
        elif category == "clients" and office_client_id:
            conditions.append(Obligation.client_id != office_client_id)

        if status:
            conditions.append(Obligation.status == status)

        if year:
            conditions.append(func.extract("year", Obligation.due_date) == year)

        if month:
            conditions.append(func.extract("month", Obligation.due_date) == month)

        where_clause = and_(*conditions) if conditions else True

        # Count total
        count_stmt = (
            select(func.count())
            .select_from(Obligation)
            .join(Client, Obligation.client_id == Client.id)
            .where(where_clause)
        )
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Get paginated results
        stmt = (
            select(Obligation)
            .join(Client, Obligation.client_id == Client.id)
            .where(where_clause)
            .options(
                selectinload(Obligation.obligation_type),
                selectinload(Obligation.client),
            )
            .order_by(
                Obligation.deleted_at.desc(),
                Obligation.due_date.asc(),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        items = result.scalars().all()

        return items, total

    async def list_by_client(
        self,
        client_id: Optional[UUID] = None,
        status: Optional[ObligationStatus] = None,
        year: Optional[int] = None,
        month: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Obligation], int]:
        """Backward-compatible alias for list filters."""
        return await self.list_with_filters(
            client_id=client_id,
            status=status,
            year=year,
            month=month,
            skip=skip,
            limit=limit,
        )

    async def list_pending_by_due_date(self, until_date: datetime) -> Sequence[Obligation]:
        """List all pending obligations with due date until specified date."""
        stmt = (
            select(Obligation)
            .where(
                and_(
                    Obligation.status == ObligationStatus.PENDENTE,
                    Obligation.due_date <= until_date,
                    Obligation.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(Obligation.obligation_type),
                selectinload(Obligation.client),
            )
            .order_by(Obligation.due_date.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def list_overdue(self, reference_date: Optional[datetime] = None) -> Sequence[Obligation]:
        """List all overdue obligations."""
        if reference_date is None:
            reference_date = datetime.utcnow()

        stmt = (
            select(Obligation)
            .where(
                and_(
                    Obligation.status == ObligationStatus.PENDENTE,
                    Obligation.due_date < reference_date,
                    Obligation.deleted_at.is_(None),
                )
            )
            .options(
                selectinload(Obligation.obligation_type),
                selectinload(Obligation.client),
            )
            .order_by(Obligation.due_date.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_client_and_type_and_period(
        self,
        client_id: UUID,
        obligation_type_id: UUID,
        year: int,
        month: int,
    ) -> Optional[Obligation]:
        """Get obligation by client, type and period (year/month)."""
        stmt = select(Obligation).where(
            and_(
                Obligation.client_id == client_id,
                Obligation.obligation_type_id == obligation_type_id,
                func.extract("year", Obligation.due_date) == year,
                func.extract("month", Obligation.due_date) == month,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        obligation_id: UUID,
        status: ObligationStatus,
        completed_at: Optional[datetime] | object = _UNSET,
        receipt_url: Optional[str] | object = _UNSET,
        processed_by_id: Optional[UUID] | object = _UNSET,
    ) -> Optional[Obligation]:
        """Update obligation status and related fields."""
        obligation = await self.get(obligation_id)
        if not obligation:
            return None

        obligation.status = status

        if completed_at is not _UNSET:
            obligation.completed_at = completed_at

        if receipt_url is not _UNSET:
            obligation.receipt_url = receipt_url

        if processed_by_id is not _UNSET:
            obligation.completed_by = processed_by_id

        await self.db.flush()
        await self.db.refresh(obligation)

        return obligation

    async def bulk_create(self, obligations: list[Obligation]) -> list[Obligation]:
        """Create multiple obligations at once."""
        self.db.add_all(obligations)
        await self.db.flush()

        # Refresh all to get IDs
        for obligation in obligations:
            await self.db.refresh(obligation)

        return obligations

    async def restore(self, obligation_id: UUID) -> bool:
        """Restore a soft-deleted obligation."""
        obligation = await self.get(obligation_id)
        if obligation and obligation.deleted_at is not None:
            obligation.deleted_at = None
            await self.db.flush()
            return True
        return False
