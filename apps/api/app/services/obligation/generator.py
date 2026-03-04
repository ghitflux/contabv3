"""Obligation Generator Service - Generates obligations for clients based on their rules."""

from datetime import datetime, timedelta
from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.client import Client, ClientStatus
from app.db.models.obligation import Obligation, ObligationStatus
from app.db.models.obligation_type import ObligationType
from app.db.models.obligation_event import ObligationEvent, ObligationEventType
from app.db.repositories.obligation import ObligationRepository
from app.db.repositories.obligation_event import ObligationEventRepository
from app.patterns.factories.obligation_factory import ObligationFactory
from app.services.obligation.activity_notification import (
    send_due_soon_notifications_for_obligation,
    sync_obligation_activities_for_list,
)
from app.services.obligation.seed_types import ensure_obligation_types


class ObligationGenerator:
    """Service for generating obligations for clients."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.obligation_repo = ObligationRepository(db)
        self.event_repo = ObligationEventRepository(db)
        self.factory = ObligationFactory(db)

    async def generate_for_client(
        self,
        client: Client,
        year: int,
        month: int,
        generated_by_id: Optional[UUID] = None,
    ) -> list[Obligation]:
        """
        Generate all applicable obligations for a client for a specific month.

        Args:
            client: Client to generate obligations for
            year: Year to generate for
            month: Month to generate for
            generated_by_id: ID of user who triggered generation (optional)

        Returns:
            List of created obligations
        """
        await ensure_obligation_types(self.db)
        # Create reference month date (first day of the month)
        from datetime import date as date_type
        reference_month = date_type(year, month, 1)

        # Generate obligations using factory
        # Factory handles duplicate checking and event creation internally
        obligations = await self.factory.generate_for_client(
            client=client,
            reference_month=reference_month,
            user_id=generated_by_id,
        )

        if obligations:
            obligation_ids = [obligation.id for obligation in obligations]
            created_result = await self.db.execute(
                select(Obligation)
                .options(
                    selectinload(Obligation.client),
                    selectinload(Obligation.obligation_type),
                )
                .where(Obligation.id.in_(obligation_ids))
            )
            created_with_relations = created_result.scalars().all()

            await sync_obligation_activities_for_list(
                self.db,
                created_with_relations,
                preferred_user_id=generated_by_id,
            )

            for created_obligation in created_with_relations:
                await send_due_soon_notifications_for_obligation(
                    self.db,
                    created_obligation,
                    reminder_days=5,
                )

        # Commit changes
        await self.db.commit()

        return obligations

    async def generate_for_all_clients(
        self,
        year: int,
        month: int,
        generated_by_id: Optional[UUID] = None,
    ) -> dict[str, int]:
        """
        Generate obligations for all active clients for a specific month.

        Args:
            year: Year to generate for
            month: Month to generate for
            generated_by_id: ID of user who triggered generation (optional)

        Returns:
            Dictionary with statistics about generation
        """
        await ensure_obligation_types(self.db)
        # Get all operational clients (active + delinquent)
        stmt = select(Client).where(
            Client.status.in_([ClientStatus.ATIVO, ClientStatus.INADIMPLENTE]),
            Client.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        total_clients = len(clients)
        total_obligations = 0
        errors = 0

        for client in clients:
            try:
                obligations = await self.generate_for_client(
                    client=client,
                    year=year,
                    month=month,
                    generated_by_id=generated_by_id,
                )
                total_obligations += len(obligations)
            except Exception as e:
                print(f"Error generating obligations for client {client.id}: {e}")
                errors += 1

        return {
            "total_clients": total_clients,
            "total_obligations": total_obligations,
            "errors": errors,
        }

    async def check_pending_obligations(
        self,
        days_ahead: int = 7,
    ) -> Sequence[Obligation]:
        """
        Get pending obligations due in the next X days.

        Args:
            days_ahead: Number of days to look ahead

        Returns:
            List of pending obligations
        """
        until_date = datetime.utcnow() + timedelta(days=days_ahead)
        return await self.obligation_repo.list_pending_by_due_date(until_date)

    async def get_overdue_obligations(self) -> Sequence[Obligation]:
        """Get all overdue obligations."""
        return await self.obligation_repo.list_overdue()
