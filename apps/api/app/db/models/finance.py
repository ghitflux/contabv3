"""Financial transaction models."""

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base


class TransactionType(str, enum.Enum):
    """Type of financial transaction."""

    RECEITA = "receita"
    DESPESA = "despesa"


class PaymentMethod(str, enum.Enum):
    """Payment method options."""

    PIX = "pix"
    BOLETO = "boleto"
    TRANSFERENCIA = "transferencia"
    DINHEIRO = "dinheiro"
    CARTAO_CREDITO = "cartao_credito"
    CARTAO_DEBITO = "cartao_debito"
    CHEQUE = "cheque"


class PaymentStatus(str, enum.Enum):
    """Payment status options."""

    PENDENTE = "pendente"
    PAGO = "pago"
    ATRASADO = "atrasado"
    CANCELADO = "cancelado"
    PARCIAL = "parcial"


class FinancialRecurringTemplate(Base):
    """Monthly recurring template for common financial launches."""

    __tablename__ = "financial_recurring_templates"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), nullable=False)
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, native_enum=False),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    start_reference_month: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    client: Mapped["Client"] = relationship("Client", foreign_keys=[client_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    transactions: Mapped[list["FinancialTransaction"]] = relationship(
        "FinancialTransaction",
        back_populates="recurring_template",
    )

    __table_args__ = (
        Index("ix_financial_recurring_templates_client_id", "client_id"),
        Index("ix_financial_recurring_templates_created_by_id", "created_by_id"),
        Index("ix_financial_recurring_templates_start_reference_month", "start_reference_month"),
        Index("ix_financial_recurring_templates_deleted_at", "deleted_at"),
        Index(
            "ix_financial_recurring_templates_client_active",
            "client_id",
            "is_active",
        ),
    )


class MonthlyFeeBlock(Base):
    """Block automatic honorários generation for a client/month."""

    __tablename__ = "monthly_fee_blocks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), nullable=False)
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    reference_month: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    client: Mapped["Client"] = relationship("Client", foreign_keys=[client_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        UniqueConstraint("client_id", "reference_month", name="uq_monthly_fee_blocks_client_month"),
        Index("ix_monthly_fee_blocks_client_id", "client_id"),
        Index("ix_monthly_fee_blocks_reference_month", "reference_month"),
    )


class FinancialTransaction(Base):
    """Financial transaction model."""

    __tablename__ = "financial_transactions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Relationships
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), nullable=False)
    obligation_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("obligations.id"), nullable=True)
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    recurring_template_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("financial_recurring_templates.id"),
        nullable=True,
    )

    # Transaction details
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, native_enum=False),
        nullable=False,
        default=TransactionType.RECEITA
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Transaction amount in BRL"
    )

    # Payment details
    payment_method: Mapped[Optional[PaymentMethod]] = mapped_column(
        Enum(PaymentMethod, native_enum=False),
        nullable=True
    )

    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False),
        nullable=False,
        default=PaymentStatus.PENDENTE
    )

    # Dates
    due_date: Mapped[date] = mapped_column(Date, nullable=False, comment="Payment due date")
    paid_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="Date when payment was received")
    reference_month: Mapped[date] = mapped_column(Date, nullable=False, comment="Reference month (competência)")

    # Description and notes
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Category (chart of accounts - plano de contas)
    category: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Chart of accounts code (Plano de Contas) - ex: 1.1.01, 2.1.05"
    )

    # Invoice/receipt
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    receipt_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    restore_blocked_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="transactions", foreign_keys=[client_id])
    obligation: Mapped[Optional["Obligation"]] = relationship("Obligation", foreign_keys=[obligation_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    recurring_template: Mapped[Optional["FinancialRecurringTemplate"]] = relationship(
        "FinancialRecurringTemplate",
        back_populates="transactions",
        foreign_keys=[recurring_template_id],
    )

    # Indexes for performance
    __table_args__ = (
        Index("ix_financial_transactions_client_id", "client_id"),
        Index("ix_financial_transactions_payment_status", "payment_status"),
        Index("ix_financial_transactions_due_date", "due_date"),
        Index("ix_financial_transactions_reference_month", "reference_month"),
        Index("ix_financial_transactions_created_at", "created_at"),
        Index("ix_financial_transactions_deleted_at", "deleted_at"),
        Index("ix_financial_transactions_category", "category"),
        Index("ix_financial_transactions_recurring_template_id", "recurring_template_id"),
        # Composite indexes for common queries
        Index("ix_financial_transactions_client_status", "client_id", "payment_status"),
        Index("ix_financial_transactions_client_reference", "client_id", "reference_month"),
    )

    def __repr__(self) -> str:
        return f"<FinancialTransaction(id={self.id}, client_id={self.client_id}, amount={self.amount}, status={self.payment_status})>"
