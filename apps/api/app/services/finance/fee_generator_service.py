"""Fee Generator Service - Generates monthly fees for clients."""

import logging
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.repositories.client import ClientRepository
from app.db.repositories.transaction import TransactionRepository

logger = logging.getLogger(__name__)


class FeeGeneratorService:
    """Service for generating monthly fees for clients."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.client_repo = ClientRepository(db)
        self.transaction_repo = TransactionRepository(db)

    async def generate_monthly_fees(
        self,
        reference_month: date,
        client_id: Optional[UUID] = None,
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        """
        Generate monthly fees for one or all active clients.

        Args:
            reference_month: Reference month (first day of month)
            client_id: Optional client ID to generate for specific client
            generated_by_id: ID of user who triggered generation

        Returns:
            Dictionary with generation statistics
        """
        # Ensure reference_month is first day of month
        if reference_month.day != 1:
            reference_month = reference_month.replace(day=1)

        if client_id:
            # Generate for specific client
            client = await self.client_repo.get(client_id)
            if not client:
                raise ValueError(f"Client with ID {client_id} not found")

            transactions = await self._generate_for_client(
                client=client,
                reference_month=reference_month,
                generated_by_id=generated_by_id,
            )

            return {
                "success": True,
                "total_clients": 1,
                "total_transactions": len(transactions),
                "errors": 0,
                "message": f"Generated {len(transactions)} transaction(s) for {client.razao_social}",
            }
        else:
            # Generate for all active clients
            return await self._generate_for_all_clients(
                reference_month=reference_month,
                generated_by_id=generated_by_id,
            )

    async def _generate_for_client(
        self,
        client: Client,
        reference_month: date,
        generated_by_id: Optional[UUID] = None,
    ) -> list[FinancialTransaction]:
        """
        Generate fee transaction for a single client.

        Args:
            client: Client instance
            reference_month: Reference month
            generated_by_id: ID of user who triggered generation

        Returns:
            List of created transactions (usually 1, but could be 0 if already exists)
        """
        # Check if already generated for this month
        existing = await self.transaction_repo.get_by_client_and_reference_month(
            client_id=client.id,
            reference_month=reference_month,
        )

        if existing:
            logger.info(
                f"Transaction already exists for client {client.id} "
                f"and month {reference_month.strftime('%Y-%m')}"
            )
            return []

        # Skip if client has no monthly fee set
        if not client.honorarios_mensais or client.honorarios_mensais <= 0:
            logger.info(
                f"Skipping client {client.id} - no monthly fee configured"
            )
            return []

        # Skip inactive clients
        if client.status != "ativo":
            logger.info(
                f"Skipping client {client.id} - not active (status: {client.status})"
            )
            return []

        # Calculate due date (always: 1st day of next month)
        due_date = self._calculate_due_date(reference_month)

        # Create transaction
        transaction = FinancialTransaction(
            client_id=client.id,
            transaction_type=TransactionType.RECEITA,
            amount=client.honorarios_mensais,
            payment_status=PaymentStatus.PENDENTE,
            due_date=due_date,
            reference_month=reference_month,
            description=f"Honorários mensais - {reference_month.strftime('%B/%Y')}",
            notes=f"Gerado automaticamente em {date.today().strftime('%d/%m/%Y')}",
            created_by_id=generated_by_id,
        )

        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)

        logger.info(
            f"Generated transaction for client {client.id} "
            f"({client.razao_social}) - R$ {client.honorarios_mensais}"
        )

        return [transaction]

    async def _generate_for_all_clients(
        self,
        reference_month: date,
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        """
        Generate fees for all active clients.

        Args:
            reference_month: Reference month
            generated_by_id: ID of user who triggered generation

        Returns:
            Dictionary with generation statistics
        """
        # Get all active clients
        stmt = select(Client).where(Client.status == "ativo", Client.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        total_clients = len(clients)
        total_transactions = 0
        errors = 0
        error_messages = []

        for client in clients:
            try:
                transactions = await self._generate_for_client(
                    client=client,
                    reference_month=reference_month,
                    generated_by_id=generated_by_id,
                )
                total_transactions += len(transactions)
            except Exception as e:
                logger.error(
                    f"Error generating fee for client {client.id}: {e}",
                    exc_info=True,
                )
                errors += 1
                error_messages.append(f"{client.razao_social}: {str(e)}")

        # Commit all changes
        await self.db.commit()

        logger.info(
            f"Fee generation complete: {total_transactions} transactions "
            f"for {total_clients} clients ({errors} errors)"
        )

        return {
            "success": True,
            "total_clients": total_clients,
            "total_transactions": total_transactions,
            "errors": errors,
            "message": (
                f"Generated {total_transactions} transaction(s) for "
                f"{total_clients} client(s). {errors} error(s) occurred."
            ),
            "error_details": error_messages if errors > 0 else None,
        }

    def _calculate_due_date(self, reference_month: date) -> date:
        """
        Calculate due date for a fee.

        Default: 1st day of the following month.

        Args:
            reference_month: Reference month (first day)

        Returns:
            Due date
        """
        # Move to next month
        if reference_month.month == 12:
            next_month = date(reference_month.year + 1, 1, 1)
        else:
            next_month = date(reference_month.year, reference_month.month + 1, 1)

        # Set due date to 1st day of next month
        try:
            due_date = next_month.replace(day=1)
        except ValueError:
            # Defensive fallback
            due_date = next_month

        return due_date

    async def get_generation_preview(
        self,
        reference_month: date,
        client_id: Optional[UUID] = None,
    ) -> dict:
        """
        Preview what fees would be generated without actually creating them.

        Args:
            reference_month: Reference month
            client_id: Optional client ID to preview for specific client

        Returns:
            Dictionary with preview information
        """
        # Ensure reference_month is first day of month
        if reference_month.day != 1:
            reference_month = reference_month.replace(day=1)

        if client_id:
            # Preview for specific client
            client = await self.client_repo.get(client_id)
            if not client:
                raise ValueError(f"Client with ID {client_id} not found")

            # Check if already exists
            existing = await self.transaction_repo.get_by_client_and_reference_month(
                client_id=client.id,
                reference_month=reference_month,
            )

            if existing:
                return {
                    "would_generate": False,
                    "reason": "Transaction already exists for this month",
                    "existing_transaction_id": str(existing.id),
                }

            if not client.honorarios_mensais or client.honorarios_mensais <= 0:
                return {
                    "would_generate": False,
                    "reason": "No monthly fee configured",
                }

            if client.status != "ativo":
                return {
                    "would_generate": False,
                    "reason": f"Client not active (status: {client.status})",
                }

            due_date = self._calculate_due_date(reference_month)

            return {
                "would_generate": True,
                "client_name": client.razao_social,
                "amount": float(client.honorarios_mensais),
                "due_date": due_date.isoformat(),
                "reference_month": reference_month.isoformat(),
            }
        else:
            # Preview for all clients
            stmt = select(Client).where(Client.status == "ativo", Client.deleted_at.is_(None))
            result = await self.db.execute(stmt)
            clients = result.scalars().all()

            total_would_generate = 0
            total_amount = Decimal("0.00")
            clients_preview = []

            for client in clients:
                # Check if already exists
                existing = await self.transaction_repo.get_by_client_and_reference_month(
                    client_id=client.id,
                    reference_month=reference_month,
                )

                if existing:
                    continue

                if not client.honorarios_mensais or client.honorarios_mensais <= 0:
                    continue

                total_would_generate += 1
                total_amount += client.honorarios_mensais
                clients_preview.append({
                    "client_id": str(client.id),
                    "client_name": client.razao_social,
                    "amount": float(client.honorarios_mensais),
                })

            due_date = self._calculate_due_date(reference_month)

            return {
                "total_clients": len(clients),
                "would_generate_count": total_would_generate,
                "total_amount": float(total_amount),
                "due_date": due_date.isoformat(),
                "reference_month": reference_month.isoformat(),
                "clients": clients_preview[:10],  # Return first 10 for preview
                "has_more": len(clients_preview) > 10,
            }
