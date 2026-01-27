"""
Factory for creating obligations based on client type.
"""

import logging
from datetime import date
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.client import Client, TipoEmpresa
from app.db.models.obligation import Obligation
from app.db.models.obligation_event import ObligationEvent, ObligationEventType
from app.db.models.obligation_type import ObligationType
from app.patterns.strategies import (
    CommerceRule,
    IndustryRule,
    MEIRule,
    ObligationRule,
    ServiceRule,
)
from app.schemas.obligation import ObligationRecurrence, ObligationStatus

logger = logging.getLogger(__name__)


class ObligationFactory:
    """
    Factory for creating obligations.

    Uses Strategy pattern to determine which obligations
    apply to each client based on their tipo_empresa and regime_tributario.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

        # Map tipo_empresa to strategy
        self.strategies: dict[TipoEmpresa, ObligationRule] = {
            TipoEmpresa.COMERCIO: CommerceRule(),
            TipoEmpresa.SERVICO: ServiceRule(),
            TipoEmpresa.INDUSTRIA: IndustryRule(),
            TipoEmpresa.FINANCEIRO: ServiceRule(),
        }

        # MEI strategy (overrides tipo_empresa)
        self.mei_strategy = MEIRule()

    def _get_strategy(self, client: Client) -> ObligationRule:
        """
        Get the appropriate strategy for a client.

        Args:
            client: Client instance

        Returns:
            ObligationRule strategy instance
        """
        # MEI has special treatment
        from app.db.models.client import RegimeTributario
        if client.regime_tributario == RegimeTributario.MEI:
            return self.mei_strategy

        # Get strategy based on tipo_empresa
        strategy = self.strategies.get(client.tipo_empresa)
        if not strategy:
            raise ValueError(f"No strategy found for tipo_empresa: {client.tipo_empresa}")

        return strategy

    async def generate_for_client(
        self,
        client: Client,
        reference_month: date,
        user_id: Optional[UUID] = None
    ) -> List[Obligation]:
        """
        Generate all obligations for a client for a given month.

        Args:
            client: Client instance
            reference_month: Reference month (first day)
            user_id: Optional user ID who triggered generation

        Returns:
            List of created Obligation instances
        """
        # Get strategy
        strategy = self._get_strategy(client)

        # Check if should generate
        if not strategy.should_generate_for_client(client):
            logger.info(f"Skipping obligation generation for client {client.id}: not eligible")
            return []

        # Fetch ObligationType models
        query = select(ObligationType).where(ObligationType.is_active == True)

        # If client has specific obligation types selected, generate only those (manual override)
        if client.obligation_types_ids:
            try:
                from uuid import UUID as UUID_TYPE

                selected_ids = [UUID_TYPE(str_id) for str_id in client.obligation_types_ids]
                query = query.where(ObligationType.id.in_(selected_ids))
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid obligation type IDs for client {client.id}: {e}")
                client_selected_ok = False
            else:
                client_selected_ok = True
        else:
            client_selected_ok = False

        if not client_selected_ok:
            # Fall back to strategy-based codes
            type_codes = strategy.get_applicable_type_codes(client)
            query = query.where(ObligationType.code.in_(type_codes))

        result = await self.db.execute(query)
        obligation_types = result.scalars().all()

        if not obligation_types:
            logger.warning(f"No active obligation types found for client {client.id}")
            return []

        reference_label = f"Referência: {reference_month.strftime('%m/%Y')}"
        type_ids = [ob_type.id for ob_type in obligation_types]

        # Check for duplicates
        existing_result = await self.db.execute(
            select(Obligation).where(
                Obligation.client_id == client.id,
                Obligation.obligation_type_id.in_(type_ids),
                Obligation.description == reference_label,
                Obligation.deleted_at.is_(None)
            )
        )
        existing_obligations = existing_result.scalars().all()

        # Map existing by obligation_type_id
        existing_by_type = {ob.obligation_type_id: ob for ob in existing_obligations}

        # Create obligations
        obligations = []
        for ob_type in obligation_types:
            if not self._should_generate_for_recurrence(ob_type, reference_month):
                continue
            # Skip if already exists
            if ob_type.id in existing_by_type:
                logger.debug(f"Obligation already exists for client {client.id}, type {ob_type.code}")
                continue

            # Calculate due date
            due_date = strategy.calculate_due_date(ob_type, reference_month, client)

            # Calculate priority
            priority = strategy.get_priority(ob_type, due_date)

            # Create obligation
            obligation = Obligation(
                id=uuid4(),
                client_id=client.id,
                obligation_type_id=ob_type.id,
                due_date=due_date,
                priority=priority,
                status=ObligationStatus.PENDENTE,
                description=reference_label
            )
            self.db.add(obligation)
            obligations.append(obligation)

            # Create event
            event = ObligationEvent.create_event(
                obligation_id=obligation.id,
                event_type=ObligationEventType.CREATED,
                description=f"Obrigação criada automaticamente para {reference_month.strftime('%m/%Y')}",
                user_id=user_id,
                extra_data={
                    "source": "factory",
                    "reference_month": reference_month.isoformat()
                }
            )
            self.db.add(event)

        logger.info(f"Generated {len(obligations)} obligations for client {client.id}")
        return obligations

    async def generate_bulk(
        self,
        reference_month: date,
        client_ids: Optional[List[UUID]] = None,
        user_id: Optional[UUID] = None
    ) -> dict:
        """
        Generate obligations for multiple clients.

        Args:
            reference_month: Reference month (first day)
            client_ids: Optional list of specific client IDs
            user_id: Optional user ID who triggered generation

        Returns:
            Dict with generation statistics
        """
        # Get clients
        query = select(Client).where(
            Client.deleted_at.is_(None)
        )

        if client_ids:
            query = query.where(Client.id.in_(client_ids))

        result = await self.db.execute(query)
        clients = result.scalars().all()

        if not clients:
            logger.warning("No clients found for bulk generation")
            return {
                "total_clients": 0,
                "total_created": 0,
                "errors": 0
            }

        # Generate for each client
        total_created = 0
        errors = 0

        for client in clients:
            try:
                obligations = await self.generate_for_client(
                    client=client,
                    reference_month=reference_month,
                    user_id=user_id
                )
                total_created += len(obligations)

            except Exception as e:
                logger.error(f"Error generating obligations for client {client.id}: {e}", exc_info=True)
                errors += 1

        # Commit all changes
        await self.db.commit()

        logger.info(f"Bulk generation complete: {total_created} obligations for {len(clients)} clients")

        return {
            "total_clients": len(clients),
            "total_created": total_created,
            "errors": errors
        }

    def _should_generate_for_recurrence(
        self,
        obligation_type: ObligationType,
        reference_month: date,
    ) -> bool:
        recurrence = getattr(obligation_type.recurrence, "value", obligation_type.recurrence)
        month = reference_month.month

        if recurrence == ObligationRecurrence.MENSAL.value:
            return True
        if recurrence == ObligationRecurrence.BIMESTRAL.value:
            return month % 2 == 0
        if recurrence == ObligationRecurrence.TRIMESTRAL.value:
            return month in {3, 6, 9, 12}
        if recurrence == ObligationRecurrence.SEMESTRAL.value:
            return month in {6, 12}
        if recurrence == ObligationRecurrence.ANUAL.value:
            if not obligation_type.month_of_year:
                logger.warning(
                    "Skipping annual obligation without month_of_year: %s",
                    obligation_type.code,
                )
                return False
            return month == obligation_type.month_of_year

        return True
