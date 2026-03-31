"""Fee Generator Service - Generates monthly fees for clients."""

import logging
import re
from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.client import Client, ClientStatus
from app.db.models.finance import (
    FinancialTransaction,
    MonthlyFeeBlock,
    PaymentStatus,
    TransactionType,
)
from app.db.repositories.client import ClientRepository
from app.schemas.finance import MonthlyFeePairUpdate
from app.services.finance.honorarios_utils import (
    build_client_auto_fee_metadata,
    build_office_auto_fee_metadata,
    compose_auto_fee_notes,
    extract_related_client_id,
    is_office_auto_fee_transaction,
    split_auto_fee_notes,
)

logger = logging.getLogger(__name__)
_OFFICE_HONORARIOS_DESCRIPTION_PATTERN = re.compile(
    r"^Honorários - (.+?) \(([^)]+)\) - (\d{2}\/\d{4})$"
)


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
    def _normalize_reference_month(reference_month: date) -> date:
        if reference_month.day == 1:
            return reference_month
        return reference_month.replace(day=1)

    @staticmethod
    def _to_naive_utc(value: datetime | None) -> datetime | None:
        """Normalize datetime values to timezone-naive UTC."""
        if value is None:
            return None
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

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

    async def _get_fee_block(
        self,
        *,
        client_id: UUID,
        reference_month: date,
    ) -> MonthlyFeeBlock | None:
        return await self.db.scalar(
            select(MonthlyFeeBlock)
            .where(
                MonthlyFeeBlock.client_id == client_id,
                MonthlyFeeBlock.reference_month == reference_month,
            )
            .limit(1)
        )

    async def _ensure_fee_block(
        self,
        *,
        client_id: UUID,
        reference_month: date,
        created_by_id: UUID,
        reason: str | None = None,
    ) -> MonthlyFeeBlock:
        normalized_reference_month = self._normalize_reference_month(reference_month)
        existing_block = await self._get_fee_block(
            client_id=client_id,
            reference_month=normalized_reference_month,
        )
        if existing_block:
            if reason and existing_block.reason != reason:
                existing_block.reason = reason
            await self.db.flush()
            return existing_block

        block = MonthlyFeeBlock(
            client_id=client_id,
            created_by_id=created_by_id,
            reference_month=normalized_reference_month,
            reason=reason,
        )
        self.db.add(block)
        await self.db.flush()
        await self.db.refresh(block)
        return block

    async def _collect_generation_state(self, client: Client, reference_month: date) -> dict:
        normalized_reference_month = self._normalize_reference_month(reference_month)
        reference_label = self._format_reference_label(normalized_reference_month)
        client_description = self._build_client_description(reference_label)
        office_description = self._build_office_description(client, reference_label)
        fee_block = await self._get_fee_block(
            client_id=client.id,
            reference_month=normalized_reference_month,
        )
        has_client_entry = await self._has_existing_honorarios_entry(
            client_id=client.id,
            reference_month=normalized_reference_month,
            transaction_type=TransactionType.DESPESA,
            description=client_description,
        )
        has_office_entry = False
        if settings.OFFICE_CLIENT_ID:
            has_office_entry = await self._has_existing_honorarios_entry(
                client_id=settings.OFFICE_CLIENT_ID,
                reference_month=normalized_reference_month,
                transaction_type=TransactionType.RECEITA,
                description=office_description,
            )

        blocked = fee_block is not None
        would_create_client_entry = not blocked and not has_client_entry
        would_create_office_entry = bool(
            settings.OFFICE_CLIENT_ID and not blocked and not has_office_entry
        )

        return {
            "reference_month": normalized_reference_month,
            "reference_label": reference_label,
            "client_description": client_description,
            "office_description": office_description,
            "due_date": self._resolve_due_date_for_client(normalized_reference_month, client.dia_vencimento),
            "blocked": blocked,
            "block_reason": fee_block.reason if fee_block else None,
            "has_client_entry": has_client_entry,
            "has_office_entry": has_office_entry,
            "would_create_client_entry": would_create_client_entry,
            "would_create_office_entry": would_create_office_entry,
        }

    @staticmethod
    def _extract_client_id_from_notes(notes: str | None) -> UUID | None:
        return extract_related_client_id(notes)

    async def _resolve_client_for_office_transaction(
        self,
        transaction: FinancialTransaction,
    ) -> Client | None:
        client_id = self._extract_client_id_from_notes(transaction.notes)
        if client_id:
            return await self.client_repo.get(client_id)

        match = _OFFICE_HONORARIOS_DESCRIPTION_PATTERN.match(transaction.description or "")
        if not match:
            return None

        cnpj = match.group(2)
        return await self.db.scalar(
            select(Client).where(Client.cnpj == cnpj, Client.deleted_at.is_(None)).limit(1)
        )

    async def _load_auto_fee_pair(
        self,
        office_transaction_id: UUID,
        *,
        include_deleted: bool = False,
        require_client_pair: bool = True,
    ) -> tuple[FinancialTransaction, Client, FinancialTransaction | None, date]:
        transaction_conditions = [FinancialTransaction.id == office_transaction_id]
        if not include_deleted:
            transaction_conditions.append(FinancialTransaction.deleted_at.is_(None))

        office_transaction = await self.db.scalar(
            select(FinancialTransaction).where(*transaction_conditions).limit(1)
        )
        if office_transaction is None:
            raise ValueError("Honorário do escritório não encontrado")
        if not is_office_auto_fee_transaction(office_transaction, settings.OFFICE_CLIENT_ID):
            raise ValueError("O lançamento informado não é um honorário automático do escritório")

        client = await self._resolve_client_for_office_transaction(office_transaction)
        if client is None:
            raise ValueError("Não foi possível resolver o cliente espelho do honorário")

        reference_month = self._normalize_reference_month(office_transaction.reference_month)
        reference_label = self._format_reference_label(reference_month)

        client_conditions = [
            FinancialTransaction.client_id == client.id,
            FinancialTransaction.reference_month == reference_month,
            FinancialTransaction.transaction_type == TransactionType.DESPESA,
            FinancialTransaction.description == self._build_client_description(reference_label),
        ]
        if not include_deleted:
            client_conditions.append(FinancialTransaction.deleted_at.is_(None))

        client_transaction = await self.db.scalar(
            select(FinancialTransaction).where(*client_conditions).limit(1)
        )
        if require_client_pair and client_transaction is None:
            raise ValueError("Não foi possível localizar o lançamento espelho do cliente")

        return office_transaction, client, client_transaction, reference_month

    @staticmethod
    def _append_notes(existing_notes: str | None, new_notes: str | None) -> str | None:
        normalized_notes = (new_notes or "").strip()
        if not normalized_notes:
            return existing_notes
        if not existing_notes:
            return normalized_notes
        return f"{existing_notes}\n\n{normalized_notes}"

    def _sync_auto_fee_notes(
        self,
        *,
        office_transaction: FinancialTransaction,
        client_transaction: FinancialTransaction,
        client_id: UUID,
        user_notes: str | None,
    ) -> None:
        office_metadata, _ = split_auto_fee_notes(office_transaction.notes)
        client_metadata, _ = split_auto_fee_notes(client_transaction.notes)

        office_base = office_metadata or build_office_auto_fee_metadata(
            office_transaction.created_at,
            client_id,
        )
        client_base = client_metadata or build_client_auto_fee_metadata(client_transaction.created_at)

        office_transaction.notes = compose_auto_fee_notes(office_base, user_notes)
        client_transaction.notes = compose_auto_fee_notes(client_base, user_notes)

    async def preview_monthly_fees(
        self,
        *,
        reference_month: date,
        client_id: Optional[UUID] = None,
        client_ids: Optional[list[UUID]] = None,
    ) -> dict:
        """Preview honorários generation for the exact competence without creating data."""
        normalized_reference_month = self._normalize_reference_month(reference_month)
        selected_client_ids = self._normalize_client_ids(
            client_id=client_id,
            client_ids=client_ids,
        )

        if selected_client_ids:
            clients: list[Client] = []
            for selected_client_id in selected_client_ids:
                client = await self.client_repo.get(selected_client_id)
                if not client:
                    raise ValueError(f"Client with ID {selected_client_id} not found")
                if self._is_client_eligible(client):
                    clients.append(client)
        else:
            clients = (
                (
                    await self.db.execute(
                        select(Client)
                        .where(
                            Client.deleted_at.is_(None),
                            Client.status != ClientStatus.INATIVO,
                            Client.gerar_lancamentos_honorarios.is_(True),
                            Client.honorarios_mensais > 0,
                        )
                        .order_by(Client.razao_social)
                    )
                )
                .scalars()
                .all()
            )

        preview_clients: list[dict] = []
        total_amount = Decimal("0.00")
        blocked_count = 0
        would_generate_count = 0
        would_generate_entries = 0

        for client in clients:
            state = await self._collect_generation_state(client, normalized_reference_month)
            would_generate_this_client = int(state["would_create_client_entry"]) + int(
                state["would_create_office_entry"]
            )
            if state["blocked"]:
                blocked_count += 1
            if would_generate_this_client > 0:
                would_generate_count += 1
                would_generate_entries += would_generate_this_client
                total_amount += Decimal(str(client.honorarios_mensais))

            preview_clients.append(
                {
                    "client_id": client.id,
                    "client_name": client.razao_social,
                    "client_cnpj": client.cnpj,
                    "amount": client.honorarios_mensais,
                    "due_date": state["due_date"],
                    "would_create_client_entry": state["would_create_client_entry"],
                    "would_create_office_entry": state["would_create_office_entry"],
                    "existing_client_entry": state["has_client_entry"],
                    "existing_office_entry": state["has_office_entry"],
                    "blocked": state["blocked"],
                    "blocked_reason": state["block_reason"],
                }
            )

        return {
            "total_clients": len(clients),
            "would_generate_count": would_generate_count,
            "would_generate_entries": would_generate_entries,
            "total_amount": total_amount,
            "reference_month": normalized_reference_month,
            "blocked_count": blocked_count,
            "has_more": False,
            "clients": preview_clients,
        }

    async def bulk_delete_monthly_fees(
        self,
        *,
        office_transaction_ids: list[UUID],
        deleted_by_id: UUID,
        reason: str | None = None,
    ) -> dict:
        """Delete office/client honorários pairs and block regeneration for the competence."""
        normalized_reason = reason or "Competência bloqueada após exclusão manual de honorários."
        transactions = (
            (
                await self.db.execute(
                    select(FinancialTransaction).where(
                        FinancialTransaction.id.in_(office_transaction_ids),
                        FinancialTransaction.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        transactions_by_id = {transaction.id: transaction for transaction in transactions}

        items: list[dict] = []
        blocked_pairs: set[tuple[UUID, date]] = set()
        now = datetime.utcnow()

        for office_transaction_id in office_transaction_ids:
            office_transaction = transactions_by_id.get(office_transaction_id)
            if office_transaction is None:
                items.append(
                    {
                        "office_transaction_id": office_transaction_id,
                        "success": False,
                        "detail": "Honorários do escritório não encontrado",
                    }
                )
                continue

            if not is_office_auto_fee_transaction(office_transaction, settings.OFFICE_CLIENT_ID):
                items.append(
                    {
                        "office_transaction_id": office_transaction_id,
                        "success": False,
                        "detail": "O lançamento informado não é um honorário automático do escritório",
                    }
                )
                continue

            client = await self._resolve_client_for_office_transaction(office_transaction)
            if client is None:
                items.append(
                    {
                        "office_transaction_id": office_transaction_id,
                        "success": False,
                        "detail": "Não foi possível resolver o cliente espelho do honorário",
                    }
                )
                continue

            reference_month = self._normalize_reference_month(office_transaction.reference_month)
            reference_label = self._format_reference_label(reference_month)
            client_transaction = await self.db.scalar(
                select(FinancialTransaction)
                .where(
                    FinancialTransaction.client_id == client.id,
                    FinancialTransaction.reference_month == reference_month,
                    FinancialTransaction.transaction_type == TransactionType.DESPESA,
                    FinancialTransaction.description == self._build_client_description(reference_label),
                    FinancialTransaction.deleted_at.is_(None),
                )
                .limit(1)
            )

            await self._ensure_fee_block(
                client_id=client.id,
                reference_month=reference_month,
                created_by_id=deleted_by_id,
                reason=normalized_reason,
            )
            blocked_pairs.add((client.id, reference_month))

            office_transaction.deleted_at = now
            office_transaction.restore_blocked_reason = normalized_reason
            deleted_client_entry = False
            if client_transaction is not None:
                client_transaction.deleted_at = now
                client_transaction.restore_blocked_reason = normalized_reason
                deleted_client_entry = True

            items.append(
                {
                    "office_transaction_id": office_transaction_id,
                    "client_id": client.id,
                    "reference_month": reference_month,
                    "success": True,
                    "deleted_office_entry": True,
                    "deleted_client_entry": deleted_client_entry,
                    "blocked": True,
                    "detail": None,
                }
            )

        if items:
            await self.db.flush()

        succeeded = sum(1 for item in items if item["success"])
        return {
            "success": True,
            "requested": len(office_transaction_ids),
            "succeeded": succeeded,
            "failed": len(items) - succeeded,
            "blocked_competences": len(blocked_pairs),
            "items": items,
        }

    async def mark_monthly_fee_as_paid(
        self,
        *,
        office_transaction_id: UUID,
        paid_date: datetime,
        payment_method,
        notes: str | None = None,
    ) -> dict:
        """Mark both sides of an automatic honorários pair as paid."""
        office_transaction, client, client_transaction, _ = await self._load_auto_fee_pair(
            office_transaction_id,
            require_client_pair=True,
        )
        assert client_transaction is not None

        if (
            office_transaction.payment_status == PaymentStatus.PAGO
            and client_transaction.payment_status == PaymentStatus.PAGO
        ):
            raise ValueError("Honorário já está baixado")

        normalized_paid_date = self._to_naive_utc(paid_date)
        office_transaction.payment_status = PaymentStatus.PAGO
        office_transaction.paid_date = normalized_paid_date
        office_transaction.payment_method = payment_method
        office_transaction.notes = self._append_notes(office_transaction.notes, notes)

        client_transaction.payment_status = PaymentStatus.PAGO
        client_transaction.paid_date = normalized_paid_date
        client_transaction.payment_method = payment_method
        client_transaction.notes = self._append_notes(client_transaction.notes, notes)

        await self.db.flush()
        await self.db.refresh(office_transaction)
        await self.db.refresh(client_transaction)

        return {
            "success": True,
            "client_id": client.id,
            "reference_month": self._normalize_reference_month(office_transaction.reference_month),
            "office_transaction": office_transaction,
            "client_transaction": client_transaction,
            "blocked_competence": False,
            "detail": None,
        }

    async def update_monthly_fee_pair(
        self,
        *,
        office_transaction_id: UUID,
        data: MonthlyFeePairUpdate,
    ) -> dict:
        """Update editable fields on both sides of an automatic honorários pair."""
        office_transaction, client, client_transaction, _ = await self._load_auto_fee_pair(
            office_transaction_id,
            require_client_pair=True,
        )
        assert client_transaction is not None

        fields_set = data.model_fields_set
        if "amount" in fields_set and data.amount is not None:
            normalized_amount = Decimal(str(data.amount)).quantize(Decimal("0.01"))
            office_transaction.amount = normalized_amount
            client_transaction.amount = normalized_amount
        if "due_date" in fields_set and data.due_date is not None:
            office_transaction.due_date = data.due_date
            client_transaction.due_date = data.due_date
        if "notes" in fields_set:
            self._sync_auto_fee_notes(
                office_transaction=office_transaction,
                client_transaction=client_transaction,
                client_id=client.id,
                user_notes=data.notes,
            )
        if "invoice_number" in fields_set:
            office_transaction.invoice_number = data.invoice_number
            client_transaction.invoice_number = data.invoice_number
        if "payment_method" in fields_set:
            office_transaction.payment_method = data.payment_method
            client_transaction.payment_method = data.payment_method
        if "paid_date" in fields_set:
            normalized_paid_date = self._to_naive_utc(data.paid_date)
            office_transaction.paid_date = normalized_paid_date
            client_transaction.paid_date = normalized_paid_date
            next_status = (
                PaymentStatus.PAGO if normalized_paid_date is not None else PaymentStatus.PENDENTE
            )
            office_transaction.payment_status = next_status
            client_transaction.payment_status = next_status
            if normalized_paid_date is None and "payment_method" not in fields_set:
                office_transaction.payment_method = None
                client_transaction.payment_method = None

        await self.db.flush()
        await self.db.refresh(office_transaction)
        await self.db.refresh(client_transaction)

        return {
            "success": True,
            "client_id": client.id,
            "reference_month": self._normalize_reference_month(office_transaction.reference_month),
            "office_transaction": office_transaction,
            "client_transaction": client_transaction,
            "blocked_competence": False,
            "detail": None,
        }

    async def delete_monthly_fee_pair(
        self,
        *,
        office_transaction_id: UUID,
        deleted_by_id: UUID,
        reason: str | None = None,
    ) -> dict:
        """Delete one automatic honorários pair and block the competence."""
        office_transaction, client, _, reference_month = await self._load_auto_fee_pair(
            office_transaction_id,
            require_client_pair=False,
        )

        result = await self.bulk_delete_monthly_fees(
            office_transaction_ids=[office_transaction_id],
            deleted_by_id=deleted_by_id,
            reason=reason,
        )
        item = result["items"][0]
        if not item["success"]:
            raise ValueError(item["detail"] or "Não foi possível excluir o honorário")

        _, _, client_transaction, _ = await self._load_auto_fee_pair(
            office_transaction_id,
            include_deleted=True,
            require_client_pair=False,
        )

        return {
            "success": True,
            "client_id": client.id,
            "reference_month": reference_month,
            "office_transaction": office_transaction,
            "client_transaction": client_transaction,
            "blocked_competence": True,
            "detail": item.get("detail"),
        }

    async def _get_last_generated_reference_month(self, client: Client) -> Optional[date]:
        client_month = await self.db.scalar(
            select(func.max(FinancialTransaction.reference_month))
            .where(
                FinancialTransaction.client_id == client.id,
                FinancialTransaction.transaction_type == TransactionType.DESPESA,
                FinancialTransaction.deleted_at.is_(None),
                FinancialTransaction.description.like("Honorários do escritório - %"),
            )
        )

        office_month: Optional[date] = None
        if settings.OFFICE_CLIENT_ID:
            office_month = await self.db.scalar(
                select(func.max(FinancialTransaction.reference_month))
                .where(
                    FinancialTransaction.client_id == settings.OFFICE_CLIENT_ID,
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                    FinancialTransaction.deleted_at.is_(None),
                    FinancialTransaction.description.like("Honorários - %"),
                    FinancialTransaction.notes.is_not(None),
                    FinancialTransaction.notes.ilike(f"%Cliente: {client.id}%"),
                )
            )

        candidates = [candidate for candidate in [client_month, office_month] if candidate is not None]
        return max(candidates) if candidates else None

    async def _build_generation_reference_months(
        self,
        client: Client,
        until_month: date,
    ) -> list[date]:
        normalized_until_month = self._normalize_reference_month(until_month)
        last_generated_month = await self._get_last_generated_reference_month(client)

        if last_generated_month is None:
            return [normalized_until_month]

        months: list[date] = []
        current_month = self._get_first_day_of_next_month(last_generated_month)
        while current_month <= normalized_until_month:
            months.append(current_month)
            current_month = self._get_first_day_of_next_month(current_month)

        # Always re-check the current month so half-generated pairs are reconciled.
        if normalized_until_month not in months:
            months.append(normalized_until_month)

        deduped_months: list[date] = []
        seen: set[date] = set()
        for item in sorted(months):
            if item in seen:
                continue
            seen.add(item)
            deduped_months.append(item)
        return deduped_months

    async def generate_monthly_fees(
        self,
        reference_month: date,
        client_id: Optional[UUID] = None,
        client_ids: Optional[list[UUID]] = None,
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        """
        Generate monthly fees for one or all eligible clients for the exact month provided.
        """
        reference_month = self._normalize_reference_month(reference_month)

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

    async def generate_missing_monthly_fees(
        self,
        reference_month: date,
        generated_by_id: Optional[UUID] = None,
    ) -> dict:
        """
        Generate all missing monthly fees through the provided reference month.
        """
        normalized_reference_month = self._normalize_reference_month(reference_month)

        stmt = (
            select(Client)
            .where(
                Client.deleted_at.is_(None),
                Client.status != ClientStatus.INATIVO,
                Client.gerar_lancamentos_honorarios.is_(True),
                Client.honorarios_mensais > 0,
            )
            .order_by(Client.razao_social)
        )
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

        total_transactions = 0
        created_client_entries = 0
        created_office_entries = 0
        skipped = 0
        errors = 0
        error_messages: list[str] = []

        for client in clients:
            try:
                months_to_generate = await self._build_generation_reference_months(
                    client=client,
                    until_month=normalized_reference_month,
                )
                client_transactions_created = 0

                for month in months_to_generate:
                    transactions = await self._generate_for_client(
                        client=client,
                        reference_month=month,
                        generated_by_id=generated_by_id,
                    )
                    if not transactions:
                        continue

                    client_transactions_created += len(transactions)
                    total_transactions += len(transactions)
                    created_client_entries += sum(
                        1
                        for tx in transactions
                        if tx.client_id == client.id
                        and tx.transaction_type == TransactionType.DESPESA
                    )
                    created_office_entries += sum(
                        1
                        for tx in transactions
                        if settings.OFFICE_CLIENT_ID
                        and tx.client_id == settings.OFFICE_CLIENT_ID
                        and tx.transaction_type == TransactionType.RECEITA
                    )

                if client_transactions_created == 0:
                    skipped += 1
            except Exception as exc:
                logger.error(
                    f"Error generating missing fee for client {client.id}: {exc}",
                    exc_info=True,
                )
                errors += 1
                error_messages.append(f"{client.razao_social}: {str(exc)}")

        await self.db.commit()

        return {
            "success": True,
            "reference_month": normalized_reference_month.isoformat(),
            "total_clients": len(clients),
            "total_transactions": total_transactions,
            "created_client_entries": created_client_entries,
            "created_office_entries": created_office_entries,
            "skipped": skipped,
            "errors": errors,
            "message": (
                f"Gerados {total_transactions} lançamento(s) de honorários até "
                f"{self._format_reference_label(normalized_reference_month)}; "
                f"{skipped} cliente(s) sem novos lançamentos e {errors} com erro."
            ),
            "error_details": error_messages if errors > 0 else None,
        }

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

        state = await self._collect_generation_state(client, reference_month)
        if state["blocked"]:
            return []

        reference_month = state["reference_month"]
        due_date = state["due_date"]
        creator_id = generated_by_id or client.user_id
        if not creator_id:
            raise ValueError(
                f"No created_by_id available to generate honorários for client {client.id}"
            )

        created_transactions: list[FinancialTransaction] = []

        if state["would_create_client_entry"]:
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
                    description=state["client_description"],
                    category=None,
                    notes=(
                        f"Gerado automaticamente em {date.today().strftime('%d/%m/%Y')} "
                        "(honorários recorrentes)."
                    ),
                    invoice_number=None,
                    created_by_id=creator_id,
                )
            )

        if settings.OFFICE_CLIENT_ID:
            if state["would_create_office_entry"]:
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
                        description=state["office_description"],
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
        Generate fees for all eligible clients for the exact month provided.
        """
        stmt = (
            select(Client)
            .where(
                Client.deleted_at.is_(None),
                Client.status != ClientStatus.INATIVO,
                Client.gerar_lancamentos_honorarios.is_(True),
                Client.honorarios_mensais > 0,
            )
            .order_by(Client.razao_social)
        )
        result = await self.db.execute(stmt)
        clients = result.scalars().all()

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
            "total_clients": len(clients),
            "total_transactions": total_transactions,
            "created_client_entries": created_client_entries,
            "created_office_entries": created_office_entries,
            "skipped": skipped,
            "errors": errors,
            "message": (
                f"Gerados {total_transactions} lançamento(s) para {len(clients)} cliente(s); "
                f"{skipped} sem novos lançamentos e {errors} com erro."
            ),
            "error_details": error_messages if errors > 0 else None,
        }
