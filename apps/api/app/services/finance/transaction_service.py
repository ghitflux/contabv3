"""Transaction Service - Business logic for financial transactions."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.client import ClientStatus
from app.db.models.finance import (
    FinancialRecurringTemplate,
    FinancialTransaction,
    PaymentStatus,
    TransactionType,
)
from app.db.repositories.client import ClientRepository
from app.db.repositories.transaction import TransactionRepository
from app.schemas.finance import TransactionCreate, TransactionUpdate
from app.services.finance.honorarios_utils import is_auto_fee_transaction


class TransactionService:
    """Service for managing financial transactions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.transaction_repo = TransactionRepository(db)
        self.client_repo = ClientRepository(db)

    @staticmethod
    def _normalize_amount(value: Decimal) -> Decimal:
        """Normalize transaction amount to 2 decimal places."""
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _to_naive_utc(value: datetime | None) -> datetime | None:
        """
        Normalize datetime values to timezone-naive UTC.

        DB columns for financial dates use `timestamp without time zone`.
        """
        if value is None:
            return None
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def _normalize_reference_month(reference_month: date) -> date:
        """Always keep competence on first day of month."""
        if reference_month.day == 1:
            return reference_month
        return reference_month.replace(day=1)

    @staticmethod
    def _get_next_month(reference_month: date) -> date:
        """Return the next competence month."""
        if reference_month.month == 12:
            return date(reference_month.year + 1, 1, 1)
        return date(reference_month.year, reference_month.month + 1, 1)

    @staticmethod
    def _iter_months(start_month: date, end_month: date) -> list[date]:
        """List competence months from start to end, inclusive."""
        months: list[date] = []
        current = start_month
        while current <= end_month:
            months.append(current)
            current = TransactionService._get_next_month(current)
        return months

    @staticmethod
    def _resolve_due_date(reference_month: date, due_day: int) -> date:
        """Clamp recurring due day to the month's last day."""
        safe_day = max(1, min(31, due_day))
        last_day = monthrange(reference_month.year, reference_month.month)[1]
        return reference_month.replace(day=min(safe_day, last_day))

    @staticmethod
    def _is_honorarios_transaction(transaction: FinancialTransaction) -> bool:
        """Automatic honorários entries use their own paired flow."""
        return is_auto_fee_transaction(transaction, settings.OFFICE_CLIENT_ID)

    async def _create_missing_occurrence_from_template(
        self,
        template: FinancialRecurringTemplate,
        *,
        reference_month: date,
        fallback_created_by_id: UUID | None = None,
    ) -> FinancialTransaction | None:
        """Create one competence occurrence for a recurring template when absent."""
        if template.deleted_at is not None or not template.is_active:
            return None

        normalized_reference_month = self._normalize_reference_month(reference_month)
        existing_transaction = await self.db.scalar(
            select(FinancialTransaction)
            .where(
                FinancialTransaction.recurring_template_id == template.id,
                FinancialTransaction.reference_month == normalized_reference_month,
                FinancialTransaction.deleted_at.is_(None),
            )
            .limit(1)
        )
        if existing_transaction is not None:
            return None

        created_by_id = template.created_by_id or fallback_created_by_id
        if created_by_id is None:
            raise ValueError(f"No created_by_id available for recurring template {template.id}")

        transaction = FinancialTransaction(
            client_id=template.client_id,
            obligation_id=None,
            created_by_id=created_by_id,
            recurring_template_id=template.id,
            transaction_type=template.transaction_type,
            amount=self._normalize_amount(template.amount),
            payment_method=None,
            payment_status=PaymentStatus.PENDENTE,
            due_date=self._resolve_due_date(normalized_reference_month, template.due_day),
            paid_date=None,
            reference_month=normalized_reference_month,
            description=template.description,
            category=template.category,
            notes=template.notes,
            invoice_number=None,
        )

        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def _deactivate_recurring_series(
        self,
        transaction: FinancialTransaction,
        *,
        restore_blocked_reason: str,
    ) -> int:
        """Deactivate a recurring series and delete future pending occurrences."""
        if transaction.recurring_template_id is None:
            return 0

        now = datetime.utcnow()
        template = await self.db.scalar(
            select(FinancialRecurringTemplate)
            .where(FinancialRecurringTemplate.id == transaction.recurring_template_id)
            .limit(1)
        )
        if template:
            template.is_active = False
            template.deleted_at = now

        future_transactions = (
            (
                await self.db.execute(
                    select(FinancialTransaction).where(
                        FinancialTransaction.recurring_template_id == transaction.recurring_template_id,
                        FinancialTransaction.deleted_at.is_(None),
                        FinancialTransaction.reference_month > transaction.reference_month,
                        FinancialTransaction.payment_status != PaymentStatus.PAGO,
                    )
                )
            )
            .scalars()
            .all()
        )

        transaction.deleted_at = now
        transaction.restore_blocked_reason = restore_blocked_reason

        for future_transaction in future_transactions:
            future_transaction.deleted_at = now
            future_transaction.restore_blocked_reason = restore_blocked_reason

        await self.db.flush()
        return len(future_transactions)

    async def create_transaction(
        self,
        data: TransactionCreate,
        created_by_id: UUID,
    ) -> FinancialTransaction:
        """
        Create a new financial transaction or a recurring template with the first pending occurrence.
        """
        client = await self.client_repo.get(data.client_id)
        if not client:
            raise ValueError(f"Client with ID {data.client_id} not found")

        if data.is_recurring:
            recurring_day = data.recurring_day or data.due_date.day or 1
            reference_month = self._normalize_reference_month(data.reference_month)
            template = FinancialRecurringTemplate(
                client_id=data.client_id,
                created_by_id=created_by_id,
                transaction_type=data.transaction_type,
                amount=self._normalize_amount(data.amount),
                description=data.description,
                category=data.category,
                notes=data.notes,
                due_day=max(1, min(31, recurring_day)),
                start_reference_month=reference_month,
                is_active=True,
            )
            self.db.add(template)
            await self.db.flush()

            transaction = await self._create_missing_occurrence_from_template(
                template,
                reference_month=reference_month,
                fallback_created_by_id=created_by_id,
            )
            if transaction is None:
                raise ValueError("Could not create the first recurring occurrence")
            return transaction

        transaction = FinancialTransaction(
            client_id=data.client_id,
            obligation_id=data.obligation_id,
            transaction_type=data.transaction_type,
            amount=self._normalize_amount(data.amount),
            payment_method=data.payment_method,
            payment_status=data.payment_status,
            due_date=data.due_date,
            paid_date=self._to_naive_utc(data.paid_date),
            reference_month=self._normalize_reference_month(data.reference_month),
            description=data.description,
            category=data.category,
            notes=data.notes,
            invoice_number=data.invoice_number,
            created_by_id=created_by_id,
        )

        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def update_transaction(
        self,
        transaction_id: UUID,
        data: TransactionUpdate,
    ) -> FinancialTransaction:
        """Update an existing transaction."""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction with ID {transaction_id} not found")
        if transaction.deleted_at is not None:
            raise ValueError(f"Transaction with ID {transaction_id} was deleted")
        if self._is_honorarios_transaction(transaction):
            raise ValueError(
                "Honorários automáticos devem ser editados pelo fluxo próprio de honorários."
            )

        fields_set = data.model_fields_set

        if "amount" in fields_set and data.amount is not None:
            transaction.amount = self._normalize_amount(data.amount)
        if "payment_method" in fields_set:
            transaction.payment_method = data.payment_method
        if "payment_status" in fields_set and data.payment_status is not None:
            transaction.payment_status = data.payment_status
        if "due_date" in fields_set and data.due_date is not None:
            transaction.due_date = data.due_date
        if "paid_date" in fields_set:
            transaction.paid_date = self._to_naive_utc(data.paid_date)
        if "description" in fields_set and data.description is not None:
            transaction.description = data.description
        if "category" in fields_set:
            transaction.category = data.category
        if "notes" in fields_set:
            transaction.notes = data.notes
        if "invoice_number" in fields_set:
            transaction.invoice_number = data.invoice_number

        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def mark_as_paid(
        self,
        transaction_id: UUID,
        paid_date: datetime,
        payment_method: str,
        notes: Optional[str] = None,
    ) -> FinancialTransaction:
        """Mark a transaction as paid."""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction with ID {transaction_id} not found")
        if transaction.deleted_at is not None:
            raise ValueError(f"Transaction with ID {transaction_id} was deleted")
        if self._is_honorarios_transaction(transaction):
            raise ValueError(
                "Honorários automáticos devem ser baixados pelo fluxo próprio de honorários."
            )
        if transaction.payment_status == PaymentStatus.PAGO:
            raise ValueError(f"Transaction {transaction_id} is already marked as paid")

        transaction.payment_status = PaymentStatus.PAGO
        transaction.paid_date = self._to_naive_utc(paid_date)
        transaction.payment_method = payment_method
        if notes:
            transaction.notes = notes if not transaction.notes else f"{transaction.notes}\n\n{notes}"

        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def cancel_transaction(
        self,
        transaction_id: UUID,
        reason: str,
    ) -> FinancialTransaction:
        """Cancel a transaction."""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction with ID {transaction_id} not found")
        if transaction.deleted_at is not None:
            raise ValueError(f"Transaction with ID {transaction_id} was deleted")
        if transaction.payment_status == PaymentStatus.PAGO:
            raise ValueError("Cannot cancel a paid transaction")

        transaction.payment_status = PaymentStatus.CANCELADO
        transaction.notes = reason if not transaction.notes else f"{transaction.notes}\n\nCancelled: {reason}"

        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def get_client_balance(self, client_id: UUID) -> Decimal:
        """Get total outstanding balance for a client."""
        return await self.transaction_repo.get_client_balance(client_id)

    async def update_overdue_status(self) -> int:
        """Update status of pending transactions that are overdue."""
        today = date.today()
        overdue_transactions = await self.transaction_repo.get_pending_by_due_date(today)

        count = 0
        for transaction in overdue_transactions:
            if transaction.due_date < today and transaction.payment_status == PaymentStatus.PENDENTE:
                transaction.payment_status = PaymentStatus.ATRASADO
                count += 1

        if count > 0:
            await self.db.flush()

        return count

    async def delete_transaction(self, transaction_id: UUID) -> bool:
        """Soft delete a transaction, ending recurring series when applicable."""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction or transaction.deleted_at is not None:
            return False

        if self._is_honorarios_transaction(transaction):
            raise ValueError(
                "Honorários automáticos devem ser excluídos pelo fluxo próprio de honorários."
            )

        if transaction.recurring_template_id:
            await self._deactivate_recurring_series(
                transaction,
                restore_blocked_reason="Série recorrente encerrada ao excluir o lançamento.",
            )
            return True

        return await self.transaction_repo.soft_delete(transaction_id)

    async def restore_transaction(self, transaction_id: UUID) -> bool:
        """Restore a soft-deleted transaction."""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            return False
        if transaction.restore_blocked_reason:
            raise ValueError(transaction.restore_blocked_reason)
        return await self.transaction_repo.restore(transaction_id)

    async def bulk_mark_as_paid(
        self,
        transaction_ids: list[UUID],
        *,
        paid_date: datetime,
        payment_method: str,
        notes: str | None = None,
    ) -> dict:
        """Mark multiple transactions as paid."""
        loaded_transactions = await self.transaction_repo.list_by_ids_with_relations(transaction_ids)
        transactions_by_id = {transaction.id: transaction for transaction in loaded_transactions}

        items: list[dict] = []
        updated_transactions: list[FinancialTransaction] = []

        for transaction_id in transaction_ids:
            transaction = transactions_by_id.get(transaction_id)
            if transaction is None:
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Transaction not found",
                    }
                )
                continue

            if transaction.payment_status == PaymentStatus.PAGO:
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Transaction is already marked as paid",
                    }
                )
                continue

            if self._is_honorarios_transaction(transaction):
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Use a baixa própria de honorários para este lançamento",
                    }
                )
                continue

            transaction.payment_status = PaymentStatus.PAGO
            transaction.paid_date = self._to_naive_utc(paid_date)
            transaction.payment_method = payment_method
            if notes:
                transaction.notes = notes if not transaction.notes else f"{transaction.notes}\n\n{notes}"
            updated_transactions.append(transaction)
            items.append({"transaction_id": transaction_id, "success": True, "detail": None})

        if updated_transactions:
            await self.db.flush()

        succeeded = sum(1 for item in items if item["success"])
        return {
            "action": "pay",
            "requested": len(transaction_ids),
            "processed": len(updated_transactions),
            "succeeded": succeeded,
            "failed": len(items) - succeeded,
            "items": items,
            "transactions": updated_transactions,
        }

    async def bulk_reopen_transactions(self, transaction_ids: list[UUID]) -> dict:
        """Reopen multiple transactions back to pending."""
        loaded_transactions = await self.transaction_repo.list_by_ids_with_relations(transaction_ids)
        transactions_by_id = {transaction.id: transaction for transaction in loaded_transactions}

        items: list[dict] = []
        updated_transactions: list[FinancialTransaction] = []

        for transaction_id in transaction_ids:
            transaction = transactions_by_id.get(transaction_id)
            if transaction is None:
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Transaction not found",
                    }
                )
                continue

            if (
                transaction.payment_status == PaymentStatus.PENDENTE
                and transaction.paid_date is None
                and transaction.payment_method is None
            ):
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Transaction is already pending",
                    }
                )
                continue

            transaction.payment_status = PaymentStatus.PENDENTE
            transaction.paid_date = None
            transaction.payment_method = None
            updated_transactions.append(transaction)
            items.append({"transaction_id": transaction_id, "success": True, "detail": None})

        if updated_transactions:
            await self.db.flush()

        succeeded = sum(1 for item in items if item["success"])
        return {
            "action": "reopen",
            "requested": len(transaction_ids),
            "processed": len(updated_transactions),
            "succeeded": succeeded,
            "failed": len(items) - succeeded,
            "items": items,
            "transactions": updated_transactions,
        }

    async def bulk_delete_transactions(self, transaction_ids: list[UUID]) -> dict:
        """Soft delete multiple transactions with recurring-series handling."""
        loaded_transactions = await self.transaction_repo.list_by_ids_with_relations(transaction_ids)
        transactions_by_id = {transaction.id: transaction for transaction in loaded_transactions}

        items: list[dict] = []
        deleted_transactions: list[FinancialTransaction] = []

        for transaction_id in transaction_ids:
            transaction = transactions_by_id.get(transaction_id)
            if transaction is None:
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Transaction not found",
                    }
                )
                continue

            if self._is_honorarios_transaction(transaction):
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": False,
                        "detail": "Use a exclusão própria de honorários para este lançamento",
                    }
                )
                continue

            if transaction.recurring_template_id:
                future_count = await self._deactivate_recurring_series(
                    transaction,
                    restore_blocked_reason="Série recorrente encerrada ao excluir o lançamento.",
                )
                deleted_transactions.append(transaction)
                items.append(
                    {
                        "transaction_id": transaction_id,
                        "success": True,
                        "detail": (
                            f"Série recorrente encerrada; {future_count} ocorrência(s) futura(s) removida(s)."
                        ),
                    }
                )
                continue

            transaction.deleted_at = datetime.utcnow()
            deleted_transactions.append(transaction)
            items.append({"transaction_id": transaction_id, "success": True, "detail": None})

        if deleted_transactions:
            await self.db.flush()

        succeeded = sum(1 for item in items if item["success"])
        return {
            "action": "delete",
            "requested": len(transaction_ids),
            "processed": len(deleted_transactions),
            "succeeded": succeeded,
            "failed": len(items) - succeeded,
            "items": items,
            "transactions": deleted_transactions,
        }

    async def generate_missing_recurring_transactions(
        self,
        *,
        until_month: date,
        fallback_created_by_id: UUID | None = None,
    ) -> dict:
        """Generate missing monthly occurrences for active recurring templates."""
        normalized_until_month = self._normalize_reference_month(until_month)
        templates = (
            (
                await self.db.execute(
                    select(FinancialRecurringTemplate).where(
                        FinancialRecurringTemplate.deleted_at.is_(None),
                        FinancialRecurringTemplate.is_active.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

        total_transactions = 0
        skipped = 0

        for template in templates:
            client = await self.client_repo.get(template.client_id)
            if client is None or client.deleted_at is not None or client.status == ClientStatus.INATIVO:
                skipped += 1
                continue

            start_month = self._normalize_reference_month(template.start_reference_month)
            if start_month > normalized_until_month:
                skipped += 1
                continue

            existing_months = set(
                (
                    await self.db.execute(
                        select(FinancialTransaction.reference_month).where(
                            FinancialTransaction.recurring_template_id == template.id,
                            FinancialTransaction.deleted_at.is_(None),
                            FinancialTransaction.reference_month <= normalized_until_month,
                        )
                    )
                )
                .scalars()
                .all()
            )

            created_for_template = 0
            for month in self._iter_months(start_month, normalized_until_month):
                if month in existing_months:
                    continue
                transaction = await self._create_missing_occurrence_from_template(
                    template,
                    reference_month=month,
                    fallback_created_by_id=fallback_created_by_id,
                )
                if transaction is None:
                    continue
                created_for_template += 1
                total_transactions += 1

            if created_for_template == 0:
                skipped += 1

        return {
            "success": True,
            "reference_month": normalized_until_month.isoformat(),
            "total_templates": len(templates),
            "total_transactions": total_transactions,
            "skipped": skipped,
            "message": (
                f"Geradas {total_transactions} ocorrência(s) recorrentes até "
                f"{normalized_until_month.strftime('%m/%Y')}."
            ),
        }
