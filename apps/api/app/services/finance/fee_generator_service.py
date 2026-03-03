"""Fee Generator Service - Generates monthly fees for clients."""

import logging
from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.client import Client, ClientStatus
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.repositories.client import ClientRepository

logger = logging.getLogger(__name__)


class FeeGeneratorService:
    """Service for generating monthly fees for clients."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.client_repo = ClientRepository(db)

    @staticmethod
    def _format_reference_label(reference_month: date) -> str:
        return reference_month.strftime("%m/%Y")

    @staticmethod
    def _build_client_description(reference_label: str) -> str:
        return f"Honorários do escritório - {reference_label}"

    @staticmethod
    def _build_office_description(client: Client, reference_label: str) -> str:
        return f"Honorários - {client.razao_social} ({client.cnpj}) - {reference_label}"

    @staticmethod
    def _get_first_day_of_next_month(reference_date: date) -> date:
        """Return the first day of the month after reference_date."""
        if reference_date.month == 12:
            return date(reference_date.year + 1, 1, 1)
        return date(reference_date.year, reference_date.month + 1, 1)

    @staticmethod
    def _resolve_due_date_for_client(reference_month: date, due_day: int | None) -> date:
        """
        Resolve due date for the reference month using client due day.

        If due day exceeds month length, clamp to the last day of month.
        """
        safe_due_day = due_day if isinstance(due_day, int) else 1
        safe_due_day = max(1, min(31, safe_due_day))
        last_day = monthrange(reference_month.year, reference_month.month)[1]
        return reference_month.replace(day=min(safe_due_day, last_day))

    @staticmethod
    def _is_client_eligible(client: Client) -> bool:
        if client.deleted_at is not None:
            return False
        if client.status == ClientStatus.INATIVO:
            return False
        if not client.gerar_lancamentos_honorarios:
            return False
        if not client.honorarios_mensais or client.honorarios_mensais <= 0:
            return False
        return True

    @staticmethod
    def _normalize_client_ids(
        client_id: Optional[UUID] = None,
        client_ids: Optional[list[UUID]] = None,
    ) -> list[UUID]:
        normalized: list[UUID] = []
        seen: set[UUID] = set()

        if client_id:
            normalized.append(client_id)
            seen.add(client_id)

        for item in client_ids or []:
            if item in seen:
                continue
            seen.add(item)
            normalized.append(item)

        return normalized

    async def _has_existing_honorarios_entry(
        self,
        *,
        client_id: UUID,
        reference_month: date,
        transaction_type: TransactionType,
        description: str,
    ) -> bool:
        existing_id = await self.db.scalar(
            select(FinancialTransaction.id)
            .where(
                FinancialTransaction.client_id == client_id,
                FinancialTransaction.reference_month == reference_month,
                FinancialTransaction.transaction_type == transaction_type,
                FinancialTransaction.description == description,
                FinancialTransaction.deleted_at.is_(None),
            )
            .limit(1)
        )
        return existing_id is not None

    async def generate_monthly_fees(
        self,
        reference_month: date,
        client_id: Optional[UUID] = None,
        client_ids: Optional[list[UUID]] = None,
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        """
        Generate monthly fees for one or all eligible clients.
        """
        if reference_month.day != 1:
            reference_month = reference_month.replace(day=1)
        # Business rule: generation references the next month; due date follows client profile.
        reference_month = self._get_first_day_of_next_month(reference_month)

        selected_client_ids = self._normalize_client_ids(
            client_id=client_id, client_ids=client_ids
        )
        if selected_client_ids:
            if len(selected_client_ids) == 1:
                selected_client = await self.client_repo.get(selected_client_ids[0])
                if not selected_client:
                    raise ValueError(f"Client with ID {selected_client_ids[0]} not found")

                transactions = await self._generate_for_client(
                    client=selected_client,
                    reference_month=reference_month,
                    generated_by_id=generated_by_id,
                )
                await self.db.commit()

                created_client_entries = sum(
                    1
                    for tx in transactions
                    if tx.client_id == selected_client.id
                    and tx.transaction_type == TransactionType.DESPESA
                )
                created_office_entries = sum(
                    1
                    for tx in transactions
                    if settings.OFFICE_CLIENT_ID
                    and tx.client_id == settings.OFFICE_CLIENT_ID
                    and tx.transaction_type == TransactionType.RECEITA
                )

                return {
                    "success": True,
                    "reference_month": reference_month.isoformat(),
                    "total_clients": 1,
                    "total_transactions": len(transactions),
                    "created_client_entries": created_client_entries,
                    "created_office_entries": created_office_entries,
                    "errors": 0,
                    "message": (
                        f"Gerados {len(transactions)} lançamento(s) de honorários para "
                        f"{selected_client.razao_social}."
                    ),
                }

            return await self._generate_for_selected_clients(
                reference_month=reference_month,
                client_ids=selected_client_ids,
                generated_by_id=generated_by_id,
            )

        return await self._generate_for_all_clients(
            reference_month=reference_month,
            generated_by_id=generated_by_id,
        )

    async def _generate_for_selected_clients(
        self,
        reference_month: date,
        client_ids: list[UUID],
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        total_transactions = 0
        created_client_entries = 0
        created_office_entries = 0
        skipped = 0
        errors = 0
        error_messages: list[str] = []

        for selected_client_id in client_ids:
            try:
                client = await self.client_repo.get(selected_client_id)
                if not client:
                    errors += 1
                    error_messages.append(f"Client with ID {selected_client_id} not found")
                    continue

                transactions = await self._generate_for_client(
                    client=client,
                    reference_month=reference_month,
                    generated_by_id=generated_by_id,
                )
                if not transactions:
                    skipped += 1
                    continue

                total_transactions += len(transactions)
                created_client_entries += sum(
                    1
                    for tx in transactions
                    if tx.client_id == client.id and tx.transaction_type == TransactionType.DESPESA
                )
                created_office_entries += sum(
                    1
                    for tx in transactions
                    if settings.OFFICE_CLIENT_ID
                    and tx.client_id == settings.OFFICE_CLIENT_ID
                    and tx.transaction_type == TransactionType.RECEITA
                )
            except Exception as exc:
                logger.error(
                    f"Error generating fee for selected client {selected_client_id}: {exc}",
                    exc_info=True,
                )
                errors += 1
                error_messages.append(f"{selected_client_id}: {str(exc)}")

        await self.db.commit()

        return {
            "success": True,
            "reference_month": reference_month.isoformat(),
            "total_clients": len(client_ids),
            "total_transactions": total_transactions,
            "created_client_entries": created_client_entries,
            "created_office_entries": created_office_entries,
            "skipped": skipped,
            "errors": errors,
            "message": (
                f"Gerados {total_transactions} lançamento(s) para {len(client_ids)} cliente(s) "
                f"selecionado(s); {skipped} sem novos lançamentos e {errors} com erro."
            ),
            "error_details": error_messages if errors > 0 else None,
        }

    async def _generate_for_client(
        self,
        client: Client,
        reference_month: date,
        generated_by_id: Optional[UUID] = None,
    ) -> list[FinancialTransaction]:
        """
        Generate recurring honorários entries for a single client.

        Creates:
        - Client ledger entry (DESPESA)
        - Office ledger entry (RECEITA), when OFFICE_CLIENT_ID is configured
        """
        if not self._is_client_eligible(client):
            return []

        reference_label = self._format_reference_label(reference_month)
        due_date = self._resolve_due_date_for_client(reference_month, client.dia_vencimento)
        creator_id = generated_by_id or client.user_id
        if not creator_id:
            raise ValueError(
                f"No created_by_id available to generate honorários for client {client.id}"
            )

        created_transactions: list[FinancialTransaction] = []

        # Client: accounts payable (expense)
        client_description = self._build_client_description(reference_label)
        has_client_entry = await self._has_existing_honorarios_entry(
            client_id=client.id,
            reference_month=reference_month,
            transaction_type=TransactionType.DESPESA,
            description=client_description,
        )
        if not has_client_entry:
            created_transactions.append(
                FinancialTransaction(
                    client_id=client.id,
                    obligation_id=None,
                    transaction_type=TransactionType.DESPESA,
                    amount=client.honorarios_mensais,
                    payment_method=None,
                    payment_status=PaymentStatus.PENDENTE,
                    due_date=due_date,
                    paid_date=None,
                    reference_month=reference_month,
                    description=client_description,
                    category=None,
                    notes=(
                        f"Gerado automaticamente em {date.today().strftime('%d/%m/%Y')} "
                        "(honorários recorrentes)."
                    ),
                    invoice_number=None,
                    created_by_id=creator_id,
                )
            )

        # Office: accounts receivable (revenue)
        if settings.OFFICE_CLIENT_ID:
            office_description = self._build_office_description(client, reference_label)
            has_office_entry = await self._has_existing_honorarios_entry(
                client_id=settings.OFFICE_CLIENT_ID,
                reference_month=reference_month,
                transaction_type=TransactionType.RECEITA,
                description=office_description,
            )
            if not has_office_entry:
                created_transactions.append(
                    FinancialTransaction(
                        client_id=settings.OFFICE_CLIENT_ID,
                        obligation_id=None,
                        transaction_type=TransactionType.RECEITA,
                        amount=client.honorarios_mensais,
                        payment_method=None,
                        payment_status=PaymentStatus.PENDENTE,
                        due_date=due_date,
                        paid_date=None,
                        reference_month=reference_month,
                        description=office_description,
                        category=None,
                        notes=(
                            f"Gerado automaticamente em {date.today().strftime('%d/%m/%Y')} "
                            f"(honorários recorrentes). Cliente: {client.id}"
                        ),
                        invoice_number=None,
                        created_by_id=creator_id,
                    )
                )
        else:
            logger.warning(
                "OFFICE_CLIENT_ID not configured; skipping office honorários entry creation"
            )

        if created_transactions:
            self.db.add_all(created_transactions)
            await self.db.flush()
            for transaction in created_transactions:
                await self.db.refresh(transaction)

        return created_transactions

    async def _generate_for_all_clients(
        self,
        reference_month: date,
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        """
        Generate fees for all eligible clients.
        """
        stmt = (
            select(Client)
            .where(
                Client.deleted_at.is_(None),
                Client.status != ClientStatus.INATIVO,
                Client.gerar_lancamentos_honorarios.is_(True),
            )
            .order_by(Client.razao_social)
        )
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        total_clients = len(clients)
        total_transactions = 0
        created_client_entries = 0
        created_office_entries = 0
        skipped = 0
        errors = 0
        error_messages: list[str] = []

        for client in clients:
            try:
                transactions = await self._generate_for_client(
                    client=client,
                    reference_month=reference_month,
                    generated_by_id=generated_by_id,
                )
                if not transactions:
                    skipped += 1
                    continue

                total_transactions += len(transactions)
                created_client_entries += sum(
                    1
                    for tx in transactions
                    if tx.client_id == client.id and tx.transaction_type == TransactionType.DESPESA
                )
                created_office_entries += sum(
                    1
                    for tx in transactions
                    if settings.OFFICE_CLIENT_ID
                    and tx.client_id == settings.OFFICE_CLIENT_ID
                    and tx.transaction_type == TransactionType.RECEITA
                )
            except Exception as exc:
                logger.error(
                    f"Error generating fee for client {client.id}: {exc}",
                    exc_info=True,
                )
                errors += 1
                error_messages.append(f"{client.razao_social}: {str(exc)}")

        await self.db.commit()

        return {
            "success": True,
            "reference_month": reference_month.isoformat(),
            "total_clients": total_clients,
            "total_transactions": total_transactions,
            "created_client_entries": created_client_entries,
            "created_office_entries": created_office_entries,
            "skipped": skipped,
            "errors": errors,
            "message": (
                f"Gerados {total_transactions} lançamento(s) para {total_clients} cliente(s); "
                f"{skipped} sem novos lançamentos e {errors} com erro."
            ),
            "error_details": error_messages if errors > 0 else None,
        }

    async def get_generation_preview(
        self,
        reference_month: date,
        client_id: Optional[UUID] = None,
        client_ids: Optional[list[UUID]] = None,
    ) -> dict:
        """
        Preview what fees would be generated without actually creating them.
        """
        if reference_month.day != 1:
            reference_month = reference_month.replace(day=1)
        # Preview follows same reference rule as generation: next month.
        reference_month = self._get_first_day_of_next_month(reference_month)

        selected_client_ids = self._normalize_client_ids(
            client_id=client_id, client_ids=client_ids
        )

        if selected_client_ids and len(selected_client_ids) == 1:
            selected_client_id = selected_client_ids[0]
            client = await self.client_repo.get(selected_client_id)
            if not client:
                raise ValueError(f"Client with ID {selected_client_id} not found")

            if not self._is_client_eligible(client):
                return {
                    "would_generate": False,
                    "reason": "Cliente não elegível para geração automática de honorários",
                }

            reference_label = self._format_reference_label(reference_month)
            due_date = self._resolve_due_date_for_client(reference_month, client.dia_vencimento)
            client_description = self._build_client_description(reference_label)
            office_description = self._build_office_description(client, reference_label)

            has_client_entry = await self._has_existing_honorarios_entry(
                client_id=client.id,
                reference_month=reference_month,
                transaction_type=TransactionType.DESPESA,
                description=client_description,
            )
            has_office_entry = True
            if settings.OFFICE_CLIENT_ID:
                has_office_entry = await self._has_existing_honorarios_entry(
                    client_id=settings.OFFICE_CLIENT_ID,
                    reference_month=reference_month,
                    transaction_type=TransactionType.RECEITA,
                    description=office_description,
                )

            would_create_client_entry = not has_client_entry
            would_create_office_entry = bool(settings.OFFICE_CLIENT_ID) and not has_office_entry

            if not would_create_client_entry and not would_create_office_entry:
                return {
                    "would_generate": False,
                    "reason": "Honorários já lançados para este cliente no mês informado",
                    "reference_month": reference_month.isoformat(),
                }

            return {
                "would_generate": True,
                "client_id": str(client.id),
                "client_name": client.razao_social,
                "amount": float(client.honorarios_mensais),
                "due_date": due_date.isoformat(),
                "reference_month": reference_month.isoformat(),
                "would_create_client_entry": would_create_client_entry,
                "would_create_office_entry": would_create_office_entry,
            }

        if selected_client_ids:
            stmt = (
                select(Client)
                .where(
                    Client.id.in_(selected_client_ids),
                    Client.deleted_at.is_(None),
                    Client.status != ClientStatus.INATIVO,
                    Client.gerar_lancamentos_honorarios.is_(True),
                )
                .order_by(Client.razao_social)
            )
        else:
            stmt = (
                select(Client)
                .where(
                    Client.deleted_at.is_(None),
                    Client.status != ClientStatus.INATIVO,
                    Client.gerar_lancamentos_honorarios.is_(True),
                )
                .order_by(Client.razao_social)
            )

        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        total_would_generate = 0
        total_entries = 0
        total_amount = Decimal("0.00")
        clients_preview: list[dict] = []

        for client in clients:
            if not self._is_client_eligible(client):
                continue

            reference_label = self._format_reference_label(reference_month)
            client_description = self._build_client_description(reference_label)
            office_description = self._build_office_description(client, reference_label)

            has_client_entry = await self._has_existing_honorarios_entry(
                client_id=client.id,
                reference_month=reference_month,
                transaction_type=TransactionType.DESPESA,
                description=client_description,
            )
            has_office_entry = True
            if settings.OFFICE_CLIENT_ID:
                has_office_entry = await self._has_existing_honorarios_entry(
                    client_id=settings.OFFICE_CLIENT_ID,
                    reference_month=reference_month,
                    transaction_type=TransactionType.RECEITA,
                    description=office_description,
                )

            would_create_client_entry = not has_client_entry
            would_create_office_entry = bool(settings.OFFICE_CLIENT_ID) and not has_office_entry
            if not would_create_client_entry and not would_create_office_entry:
                continue

            total_would_generate += 1
            total_entries += int(would_create_client_entry) + int(would_create_office_entry)
            total_amount += Decimal(str(client.honorarios_mensais))

            due_date = self._resolve_due_date_for_client(reference_month, client.dia_vencimento)
            clients_preview.append(
                {
                    "client_id": str(client.id),
                    "client_name": client.razao_social,
                    "client_cnpj": client.cnpj,
                    "amount": float(client.honorarios_mensais),
                    "due_date": due_date.isoformat(),
                    "would_create_client_entry": would_create_client_entry,
                    "would_create_office_entry": would_create_office_entry,
                }
            )

        return {
            "total_clients": len(clients),
            "would_generate_count": total_would_generate,
            "would_generate_entries": total_entries,
            "total_amount": float(total_amount),
            "reference_month": reference_month.isoformat(),
            "due_date_strategy": "dia_vencimento_cliente",
            "clients": clients_preview,
            "has_more": False,
        }
