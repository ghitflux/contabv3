"""Transaction Repository - Data access layer for financial transactions."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.repositories.base import BaseRepository


class TransactionRepository(BaseRepository[FinancialTransaction]):
    """Repository for FinancialTransaction operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(FinancialTransaction, db)

    async def get_by_id_with_relations(
        self, transaction_id: UUID, include_deleted: bool = False
    ) -> Optional[FinancialTransaction]:
        """Get transaction with all relationships loaded."""
        conditions = [FinancialTransaction.id == transaction_id]
        if not include_deleted:
            conditions.append(FinancialTransaction.deleted_at.is_(None))

        stmt = (
            select(FinancialTransaction)
            .where(and_(*conditions))
            .options(
                selectinload(FinancialTransaction.client),
                selectinload(FinancialTransaction.obligation),
                selectinload(FinancialTransaction.created_by),
                selectinload(FinancialTransaction.recurring_template),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_client(
        self,
        client_id: UUID,
        status: Optional[PaymentStatus] = None,
        reference_month: Optional[date] = None,
        due_date_from: Optional[date] = None,
        due_date_to: Optional[date] = None,
        include_deleted: bool = False,
        deleted_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[FinancialTransaction], int]:
        """List transactions for a specific client with filters."""
        conditions = [FinancialTransaction.client_id == client_id]

        if deleted_only:
            conditions.append(FinancialTransaction.deleted_at.is_not(None))
        elif not include_deleted:
            conditions.append(FinancialTransaction.deleted_at.is_(None))

        if status:
            conditions.append(FinancialTransaction.payment_status == status)

        if reference_month:
            # Finance filters labeled as "Mês de referência" must stay on competence basis,
            # even after a transaction is marked as paid.
            conditions.append(FinancialTransaction.reference_month == reference_month)

        if due_date_from:
            conditions.append(FinancialTransaction.due_date >= due_date_from)

        if due_date_to:
            conditions.append(FinancialTransaction.due_date <= due_date_to)

        # Count query
        count_stmt = (
            select(func.count())
            .select_from(FinancialTransaction)
            .where(and_(*conditions))
        )
        total = await self.db.scalar(count_stmt) or 0

        # Data query
        stmt = (
            select(FinancialTransaction)
            .where(and_(*conditions))
            .options(
                selectinload(FinancialTransaction.client),
                selectinload(FinancialTransaction.recurring_template),
            )
            .order_by(
                FinancialTransaction.due_date.desc(),
                FinancialTransaction.created_at.desc(),
                FinancialTransaction.id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        transactions = result.scalars().all()

        return transactions, total

    async def list_with_filters(
        self,
        client_id: Optional[UUID] = None,
        status: Optional[PaymentStatus] = None,
        reference_month: Optional[date] = None,
        due_date_from: Optional[date] = None,
        due_date_to: Optional[date] = None,
        include_deleted: bool = False,
        deleted_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[FinancialTransaction], int]:
        """List transactions with optional filters."""
        conditions = []

        if deleted_only:
            conditions.append(FinancialTransaction.deleted_at.is_not(None))
        elif not include_deleted:
            conditions.append(FinancialTransaction.deleted_at.is_(None))

        if client_id:
            conditions.append(FinancialTransaction.client_id == client_id)

        if status:
            conditions.append(FinancialTransaction.payment_status == status)

        if reference_month:
            # Finance filters labeled as "Mês de referência" must stay on competence basis,
            # even after a transaction is marked as paid.
            conditions.append(FinancialTransaction.reference_month == reference_month)

        if due_date_from:
            conditions.append(FinancialTransaction.due_date >= due_date_from)

        if due_date_to:
            conditions.append(FinancialTransaction.due_date <= due_date_to)

        # Count query
        count_stmt = (
            select(func.count())
            .select_from(FinancialTransaction)
            .where(and_(*conditions))
        )
        total = await self.db.scalar(count_stmt) or 0

        # Data query with client data
        stmt = (
            select(FinancialTransaction)
            .where(and_(*conditions))
            .options(
                selectinload(FinancialTransaction.client),
                selectinload(FinancialTransaction.recurring_template),
            )
            .order_by(
                FinancialTransaction.due_date.desc(),
                FinancialTransaction.created_at.desc(),
                FinancialTransaction.id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        transactions = result.scalars().all()

        return transactions, total

    async def get_by_client_and_reference_month(
        self, client_id: UUID, reference_month: date
    ) -> Optional[FinancialTransaction]:
        """Get transaction by client and reference month."""
        stmt = (
            select(FinancialTransaction)
            .where(
                and_(
                    FinancialTransaction.client_id == client_id,
                    FinancialTransaction.reference_month == reference_month,
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_client_balance(self, client_id: UUID) -> Decimal:
        """Calculate total outstanding balance for a client."""
        stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    FinancialTransaction.client_id == client_id,
                    FinancialTransaction.payment_status.in_([
                        PaymentStatus.PENDENTE,
                        PaymentStatus.ATRASADO,
                        PaymentStatus.PARCIAL,
                    ]),
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.scalar(stmt)
        return result or Decimal("0.00")

    async def get_overdue_transactions(
        self, as_of_date: Optional[date] = None
    ) -> Sequence[FinancialTransaction]:
        """Get all overdue transactions."""
        if not as_of_date:
            as_of_date = date.today()

        stmt = (
            select(FinancialTransaction)
            .where(
                and_(
                    FinancialTransaction.payment_status == PaymentStatus.PENDENTE,
                    FinancialTransaction.due_date < as_of_date,
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .options(selectinload(FinancialTransaction.client))
            .order_by(FinancialTransaction.due_date)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_pending_by_due_date(
        self, until_date: date
    ) -> Sequence[FinancialTransaction]:
        """Get pending transactions due until a specific date."""
        stmt = (
            select(FinancialTransaction)
            .where(
                and_(
                    FinancialTransaction.payment_status == PaymentStatus.PENDENTE,
                    FinancialTransaction.due_date <= until_date,
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .options(selectinload(FinancialTransaction.client))
            .order_by(FinancialTransaction.due_date)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_transactions_by_reference_month(
        self, reference_month: date, client_id: Optional[UUID] = None
    ) -> Sequence[FinancialTransaction]:
        """Get all transactions for a specific reference month."""
        conditions = [
            FinancialTransaction.reference_month == reference_month,
            FinancialTransaction.deleted_at.is_(None),
        ]

        if client_id:
            conditions.append(FinancialTransaction.client_id == client_id)

        stmt = (
            select(FinancialTransaction)
            .where(and_(*conditions))
            .options(
                selectinload(FinancialTransaction.client),
                selectinload(FinancialTransaction.recurring_template),
            )
            .order_by(FinancialTransaction.due_date)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def list_by_ids_with_relations(
        self,
        transaction_ids: list[UUID],
        include_deleted: bool = False,
    ) -> Sequence[FinancialTransaction]:
        """Load multiple transactions with relations, preserving no specific order."""
        if not transaction_ids:
            return []

        conditions = [FinancialTransaction.id.in_(transaction_ids)]
        if not include_deleted:
            conditions.append(FinancialTransaction.deleted_at.is_(None))

        stmt = (
            select(FinancialTransaction)
            .where(and_(*conditions))
            .options(
                selectinload(FinancialTransaction.client),
                selectinload(FinancialTransaction.obligation),
                selectinload(FinancialTransaction.created_by),
                selectinload(FinancialTransaction.recurring_template),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_total_by_status(
        self,
        status: PaymentStatus,
        reference_month: Optional[date] = None,
        client_id: Optional[UUID] = None,
        transaction_type: Optional[TransactionType] = None,
    ) -> Decimal:
        """Get total amount by payment status, optionally filtered by transaction type."""
        conditions = [
            FinancialTransaction.payment_status == status,
            FinancialTransaction.deleted_at.is_(None),
        ]

        if reference_month:
            if status == PaymentStatus.PAGO:
                # For paid totals: use payment month (caixa basis)
                conditions.append(
                    or_(
                        and_(
                            FinancialTransaction.paid_date.is_not(None),
                            func.extract('year', FinancialTransaction.paid_date) == reference_month.year,
                            func.extract('month', FinancialTransaction.paid_date) == reference_month.month,
                        ),
                        and_(
                            FinancialTransaction.paid_date.is_(None),
                            FinancialTransaction.reference_month == reference_month,
                        ),
                    )
                )
            else:
                conditions.append(FinancialTransaction.reference_month == reference_month)

        if client_id:
            conditions.append(FinancialTransaction.client_id == client_id)

        if transaction_type:
            conditions.append(FinancialTransaction.transaction_type == transaction_type)

        stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(and_(*conditions))
        )
        result = await self.db.scalar(stmt)
        return result or Decimal("0.00")

    async def get_revenue_by_period(
        self,
        start_month: date,
        end_month: date,
    ) -> Sequence[tuple[date, Decimal]]:
        """Get revenue (RECEITA only) grouped by month for a period."""
        stmt = (
            select(
                FinancialTransaction.reference_month,
                func.sum(FinancialTransaction.amount).label("total"),
            )
            .where(
                and_(
                    FinancialTransaction.reference_month >= start_month,
                    FinancialTransaction.reference_month <= end_month,
                    FinancialTransaction.payment_status == PaymentStatus.PAGO,
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .group_by(FinancialTransaction.reference_month)
            .order_by(FinancialTransaction.reference_month)
        )
        result = await self.db.execute(stmt)
        return result.all()

    async def get_top_clients_by_outstanding(
        self, limit: int = 10
    ) -> Sequence[tuple[UUID, str, Decimal]]:
        """Get top clients with highest outstanding balance."""
        stmt = (
            select(
                Client.id,
                Client.razao_social,
                func.sum(FinancialTransaction.amount).label("total_pendente"),
            )
            .join(Client, FinancialTransaction.client_id == Client.id)
            .where(
                and_(
                    FinancialTransaction.payment_status.in_([
                        PaymentStatus.PENDENTE,
                        PaymentStatus.ATRASADO,
                    ]),
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .group_by(Client.id, Client.razao_social)
            .order_by(func.sum(FinancialTransaction.amount).desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.all()

    async def soft_delete(self, transaction_id: UUID) -> bool:
        """Soft delete a transaction."""
        transaction = await self.get_by_id(transaction_id)
        if transaction and transaction.deleted_at is None:
            transaction.deleted_at = datetime.utcnow()
            await self.db.flush()
            return True
        return False

    async def restore(self, transaction_id: UUID) -> bool:
        """Restore a soft-deleted transaction."""
        transaction = await self.get_by_id(transaction_id)
        if transaction and transaction.deleted_at is not None:
            transaction.deleted_at = None
            await self.db.flush()
            return True
        return False

    async def bulk_create(
        self, transactions: list[FinancialTransaction]
    ) -> list[FinancialTransaction]:
        """Create multiple transactions at once."""
        self.db.add_all(transactions)
        await self.db.flush()
        return transactions
