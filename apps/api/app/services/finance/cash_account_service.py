"""Single cash account resolver for finance flows."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.bank_account import BankAccount
from app.db.models.client import Client


class CashAccountService:
    """Resolve the single cash account for each client or for the office."""

    OFFICE_CASH_NAME = "Caixa do Escritório"
    OFFICE_ACCOUNT_NUMBER = "CAIXA-ESCRITORIO"
    CLIENT_CASH_NAME = "Caixa do Cliente"

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def is_office_client(client_id: UUID | None) -> bool:
        return bool(settings.OFFICE_CLIENT_ID and client_id == settings.OFFICE_CLIENT_ID)

    @classmethod
    def client_account_number(cls, client_id: UUID) -> str:
        return f"CAIXA-{str(client_id)[:8]}"

    async def get_or_create_for_finance_client(self, client_id: UUID) -> BankAccount:
        """Return the office cash for OFFICE_CLIENT_ID, otherwise the client's cash."""
        if self.is_office_client(client_id):
            return await self.get_or_create_office_cash()
        return await self.get_or_create_client_cash(client_id)

    async def get_or_create_office_cash(self) -> BankAccount:
        stmt = (
            select(BankAccount)
            .where(BankAccount.client_id.is_(None))
            .order_by(BankAccount.created_at.asc(), BankAccount.id.asc())
            .limit(1)
        )
        bank_account = await self.db.scalar(stmt)
        if bank_account is not None:
            return bank_account

        bank_account = BankAccount(
            client_id=None,
            name=self.OFFICE_CASH_NAME,
            account_number=self.OFFICE_ACCOUNT_NUMBER,
            balance=Decimal("0.00"),
            accounting_account=None,
        )
        self.db.add(bank_account)
        await self.db.flush()
        await self.db.refresh(bank_account)
        return bank_account

    async def get_or_create_client_cash(self, client_id: UUID) -> BankAccount:
        stmt = (
            select(BankAccount)
            .where(BankAccount.client_id == client_id)
            .order_by(BankAccount.created_at.asc(), BankAccount.id.asc())
            .limit(1)
        )
        bank_account = await self.db.scalar(stmt)
        if bank_account is not None:
            return bank_account

        client_exists = await self.db.scalar(
            select(Client.id).where(Client.id == client_id).limit(1)
        )
        if client_exists is None:
            raise ValueError(f"Client with ID {client_id} not found")

        bank_account = BankAccount(
            client_id=client_id,
            name=self.CLIENT_CASH_NAME,
            account_number=self.client_account_number(client_id),
            balance=Decimal("0.00"),
            accounting_account=None,
        )
        self.db.add(bank_account)
        await self.db.flush()
        await self.db.refresh(bank_account)
        return bank_account

    async def resolve_for_transaction(
        self,
        *,
        client_id: UUID,
        requested_bank_account_id: UUID | None = None,
    ) -> BankAccount:
        """Resolve the canonical cash account and reject cross-scope bank IDs."""
        cash_account = await self.get_or_create_for_finance_client(client_id)
        if requested_bank_account_id is None or requested_bank_account_id == cash_account.id:
            return cash_account

        requested = await self.db.scalar(
            select(BankAccount).where(BankAccount.id == requested_bank_account_id).limit(1)
        )
        if requested is None:
            raise ValueError(f"Caixa com ID {requested_bank_account_id} não encontrado")

        if self.is_office_client(client_id):
            if requested.client_id is not None:
                raise ValueError("O caixa informado não pertence ao escritório.")
        elif requested.client_id != client_id:
            raise ValueError("O caixa informado não pertence ao cliente selecionado.")

        return cash_account
