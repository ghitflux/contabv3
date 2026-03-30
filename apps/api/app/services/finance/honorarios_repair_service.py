"""Repair service for honorários generated with the wrong reference month."""

from __future__ import annotations

import re
from calendar import monthrange
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, TransactionType

CLIENT_DESCRIPTION_RE = re.compile(r"^Honorários do escritório - (\d{2}/\d{4})$")
OFFICE_DESCRIPTION_RE = re.compile(r"^Honorários - .+ \(.+\) - (\d{2}/\d{4})$")
CLIENT_ID_IN_NOTES_RE = re.compile(
    r"Cliente:\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
    re.IGNORECASE,
)


class HonorariosRepairService:
    """Repairs honorários that were stored one month ahead of their real competence."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _first_day_of_month(value: date | datetime) -> date:
        if isinstance(value, datetime):
            value = value.date()
        return value.replace(day=1)

    @staticmethod
    def _first_day_of_next_month(reference_date: date) -> date:
        if reference_date.month == 12:
            return date(reference_date.year + 1, 1, 1)
        return date(reference_date.year, reference_date.month + 1, 1)

    @staticmethod
    def _first_day_of_previous_month(reference_date: date) -> date:
        if reference_date.month == 1:
            return date(reference_date.year - 1, 12, 1)
        return date(reference_date.year, reference_date.month - 1, 1)

    @staticmethod
    def _resolve_due_date_for_client(reference_month: date, due_day: int | None) -> date:
        safe_due_day = due_day if isinstance(due_day, int) else 1
        safe_due_day = max(1, min(31, safe_due_day))
        last_day = monthrange(reference_month.year, reference_month.month)[1]
        return reference_month.replace(day=min(safe_due_day, last_day))

    @staticmethod
    def _matches_honorarios_pattern(transaction: FinancialTransaction) -> bool:
        if transaction.transaction_type == TransactionType.DESPESA:
            return CLIENT_DESCRIPTION_RE.match(transaction.description or "") is not None
        if transaction.transaction_type == TransactionType.RECEITA:
            return OFFICE_DESCRIPTION_RE.match(transaction.description or "") is not None
        return False

    @classmethod
    def _is_bugged_auto_generated_honorarios(cls, transaction: FinancialTransaction) -> bool:
        if transaction.deleted_at is not None:
            return False
        if not transaction.notes or "honorários recorrentes" not in transaction.notes.lower():
            return False
        if not cls._matches_honorarios_pattern(transaction):
            return False

        created_month = cls._first_day_of_month(transaction.created_at)
        expected_bugged_reference_month = cls._first_day_of_next_month(created_month)
        return transaction.reference_month == expected_bugged_reference_month

    @staticmethod
    def _build_target_description(description: str, target_reference_month: date) -> str:
        target_label = target_reference_month.strftime("%m/%Y")
        return re.sub(r"\d{2}/\d{4}$", target_label, description)

    @staticmethod
    def _extract_related_client_id(transaction: FinancialTransaction) -> Optional[UUID]:
        if transaction.transaction_type == TransactionType.DESPESA:
            return transaction.client_id

        if not transaction.notes:
            return None
        match = CLIENT_ID_IN_NOTES_RE.search(transaction.notes)
        if not match:
            return None
        try:
            return UUID(match.group(1))
        except ValueError:
            return None

    async def repair_shifted_honorarios(self) -> dict:
        stmt = (
            select(FinancialTransaction)
            .where(
                FinancialTransaction.deleted_at.is_(None),
                FinancialTransaction.notes.is_not(None),
                FinancialTransaction.notes.ilike("%honorários recorrentes%"),
                or_(
                    FinancialTransaction.description.like("Honorários do escritório - %"),
                    FinancialTransaction.description.like("Honorários - %"),
                ),
            )
            .order_by(FinancialTransaction.created_at, FinancialTransaction.id)
        )
        result = await self.db.execute(stmt)
        transactions = result.scalars().all()

        summary = {
            "scanned": len(transactions),
            "updated": 0,
            "skipped": 0,
            "conflicts": [],
        }

        for transaction in transactions:
            if not self._is_bugged_auto_generated_honorarios(transaction):
                summary["skipped"] += 1
                continue

            related_client_id = self._extract_related_client_id(transaction)
            if not related_client_id:
                summary["conflicts"].append(
                    {
                        "transaction_id": str(transaction.id),
                        "reason": "related_client_not_found_in_transaction",
                    }
                )
                continue

            client = await self.db.get(Client, related_client_id)
            if not client:
                summary["conflicts"].append(
                    {
                        "transaction_id": str(transaction.id),
                        "reason": "related_client_missing",
                        "client_id": str(related_client_id),
                    }
                )
                continue

            target_reference_month = self._first_day_of_previous_month(transaction.reference_month)
            target_description = self._build_target_description(
                transaction.description,
                target_reference_month,
            )

            conflicting_transaction_id = await self.db.scalar(
                select(FinancialTransaction.id)
                .where(
                    FinancialTransaction.id != transaction.id,
                    FinancialTransaction.client_id == transaction.client_id,
                    FinancialTransaction.transaction_type == transaction.transaction_type,
                    FinancialTransaction.reference_month == target_reference_month,
                    FinancialTransaction.description == target_description,
                    FinancialTransaction.amount == transaction.amount,
                    FinancialTransaction.deleted_at.is_(None),
                )
                .limit(1)
            )
            if conflicting_transaction_id:
                summary["conflicts"].append(
                    {
                        "transaction_id": str(transaction.id),
                        "reason": "target_month_already_exists",
                        "conflicting_transaction_id": str(conflicting_transaction_id),
                    }
                )
                continue

            transaction.reference_month = target_reference_month
            transaction.due_date = self._resolve_due_date_for_client(
                target_reference_month,
                client.dia_vencimento,
            )
            transaction.description = target_description
            summary["updated"] += 1

        await self.db.commit()
        return summary
