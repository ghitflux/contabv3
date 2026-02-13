"""Transaction Service - Business logic for financial transactions."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.finance import FinancialTransaction, PaymentStatus
from app.db.repositories.client import ClientRepository
from app.db.repositories.transaction import TransactionRepository
from app.schemas.finance import TransactionCreate, TransactionUpdate


class TransactionService:
    """Service for managing financial transactions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.transaction_repo = TransactionRepository(db)
        self.client_repo = ClientRepository(db)

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

    async def create_transaction(
        self,
        data: TransactionCreate,
        created_by_id: UUID,
    ) -> FinancialTransaction:
        """
        Create a new financial transaction.

        Args:
            data: Transaction creation data
            created_by_id: ID of user creating the transaction

        Returns:
            Created transaction

        Raises:
            ValueError: If client not found
        """
        # Validate client exists
        client = await self.client_repo.get(data.client_id)
        if not client:
            raise ValueError(f"Client with ID {data.client_id} not found")

        # Create transaction
        transaction = FinancialTransaction(
            client_id=data.client_id,
            obligation_id=data.obligation_id,
            transaction_type=data.transaction_type,
            amount=data.amount,
            payment_method=data.payment_method,
            payment_status=data.payment_status,
            due_date=data.due_date,
            paid_date=self._to_naive_utc(data.paid_date),
            reference_month=data.reference_month,
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
        """
        Update an existing transaction.

        Args:
            transaction_id: Transaction UUID
            data: Update data

        Returns:
            Updated transaction

        Raises:
            ValueError: If transaction not found
        """
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction with ID {transaction_id} not found")
        if transaction.deleted_at is not None:
            raise ValueError(f"Transaction with ID {transaction_id} was deleted")

        # Update fields if provided
        if data.amount is not None:
            transaction.amount = data.amount
        if data.payment_method is not None:
            transaction.payment_method = data.payment_method
        if data.payment_status is not None:
            transaction.payment_status = data.payment_status
        if data.due_date is not None:
            transaction.due_date = data.due_date
        if data.paid_date is not None:
            transaction.paid_date = self._to_naive_utc(data.paid_date)
        if data.description is not None:
            transaction.description = data.description
        if data.category is not None:
            transaction.category = data.category
        if data.notes is not None:
            transaction.notes = data.notes
        if data.invoice_number is not None:
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
        """
        Mark a transaction as paid.

        Args:
            transaction_id: Transaction UUID
            paid_date: Date when payment was received
            payment_method: Payment method used
            notes: Optional notes about the payment

        Returns:
            Updated transaction

        Raises:
            ValueError: If transaction not found or already paid
        """
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction with ID {transaction_id} not found")
        if transaction.deleted_at is not None:
            raise ValueError(f"Transaction with ID {transaction_id} was deleted")

        if transaction.payment_status == PaymentStatus.PAGO:
            raise ValueError(f"Transaction {transaction_id} is already marked as paid")

        # Update transaction
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
        """
        Cancel a transaction.

        Args:
            transaction_id: Transaction UUID
            reason: Cancellation reason

        Returns:
            Cancelled transaction

        Raises:
            ValueError: If transaction not found or already paid
        """
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise ValueError(f"Transaction with ID {transaction_id} not found")
        if transaction.deleted_at is not None:
            raise ValueError(f"Transaction with ID {transaction_id} was deleted")

        if transaction.payment_status == PaymentStatus.PAGO:
            raise ValueError("Cannot cancel a paid transaction")

        # Update transaction
        transaction.payment_status = PaymentStatus.CANCELADO
        transaction.notes = reason if not transaction.notes else f"{transaction.notes}\n\nCancelled: {reason}"

        await self.db.flush()
        await self.db.refresh(transaction)

        return transaction

    async def get_client_balance(self, client_id: UUID) -> Decimal:
        """
        Get total outstanding balance for a client.

        Args:
            client_id: Client UUID

        Returns:
            Total balance (sum of pending/overdue transactions)
        """
        return await self.transaction_repo.get_client_balance(client_id)

    async def update_overdue_status(self) -> int:
        """
        Update status of pending transactions that are overdue.

        Returns:
            Number of transactions updated

        This should be run daily via a scheduled task.
        """
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
        """
        Soft delete a transaction.

        Args:
            transaction_id: Transaction UUID

        Returns:
            True if deleted, False if not found
        """
        return await self.transaction_repo.soft_delete(transaction_id)

    async def restore_transaction(self, transaction_id: UUID) -> bool:
        """
        Restore a soft-deleted transaction.

        Args:
            transaction_id: Transaction UUID

        Returns:
            True if restored, False if not found/deleted
        """
        return await self.transaction_repo.restore(transaction_id)
