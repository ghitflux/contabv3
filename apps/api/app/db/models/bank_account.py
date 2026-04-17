"""
Bank account model for client balances.
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDMixin


class BankAccount(Base, UUIDMixin, TimestampMixin):
    """Bank account tied to a client or office (client_id=null)."""

    __tablename__ = "bank_accounts"

    client_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_number: Mapped[str] = mapped_column(String(100), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    accounting_account: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    client = relationship("Client", back_populates="bank_accounts")
    transactions = relationship("FinancialTransaction", back_populates="bank_account")

    def __repr__(self) -> str:
        return f"<BankAccount {self.name} ({self.account_number})>"
