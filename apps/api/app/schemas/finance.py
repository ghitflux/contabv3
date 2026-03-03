"""Financial transaction schemas - Pydantic models for API contracts."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# Enums
class TransactionType(str, Enum):
    """Type of financial transaction."""

    RECEITA = "receita"  # Revenue/Income
    DESPESA = "despesa"  # Expense (for future use)


class PaymentMethod(str, Enum):
    """Payment method options."""

    PIX = "pix"
    BOLETO = "boleto"
    TRANSFERENCIA = "transferencia"
    DINHEIRO = "dinheiro"
    CARTAO_CREDITO = "cartao_credito"
    CARTAO_DEBITO = "cartao_debito"
    CHEQUE = "cheque"


class PaymentStatus(str, Enum):
    """Payment status options."""

    PENDENTE = "pendente"  # Pending
    PAGO = "pago"  # Paid
    ATRASADO = "atrasado"  # Overdue
    CANCELADO = "cancelado"  # Cancelled
    PARCIAL = "parcial"  # Partially paid


# Request schemas
class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""

    client_id: UUID = Field(..., description="Client UUID")
    obligation_id: Optional[UUID] = Field(None, description="Related obligation UUID (optional)")
    transaction_type: TransactionType = Field(TransactionType.RECEITA, description="Transaction type")
    amount: Decimal = Field(..., gt=0, description="Transaction amount (must be positive)")
    payment_method: Optional[PaymentMethod] = Field(None, description="Payment method")
    payment_status: PaymentStatus = Field(PaymentStatus.PENDENTE, description="Payment status")
    due_date: date = Field(..., description="Due date")
    paid_date: Optional[datetime] = Field(None, description="Date when payment was made")
    reference_month: date = Field(..., description="Reference month (competência) - first day of month")
    description: str = Field(..., min_length=1, max_length=500, description="Transaction description")
    category: Optional[str] = Field(None, max_length=20, description="Chart of accounts code (Plano de Contas) - ex: 1.1.01, 2.1.05")
    notes: Optional[str] = Field(None, max_length=2000, description="Additional notes")
    invoice_number: Optional[str] = Field(None, max_length=100, description="Invoice/receipt number")

    @field_validator("reference_month")
    def validate_reference_month(cls, v: date) -> date:
        """Ensure reference_month is the first day of a month."""
        if v.day != 1:
            return v.replace(day=1)
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "client_id": "550e8400-e29b-41d4-a716-446655440000",
                "obligation_id": None,
                "transaction_type": "receita",
                "amount": 1500.00,
                "payment_method": "pix",
                "payment_status": "pendente",
                "due_date": "2025-11-10",
                "paid_date": None,
                "reference_month": "2025-11-01",
                "description": "Honorários mensais - Novembro/2025",
                "notes": "Pagamento via PIX",
                "invoice_number": "NF-2025-001"
            }
        }


class TransactionUpdate(BaseModel):
    """Schema for updating an existing transaction."""

    amount: Optional[Decimal] = Field(None, gt=0, description="Transaction amount")
    payment_method: Optional[PaymentMethod] = Field(None, description="Payment method")
    payment_status: Optional[PaymentStatus] = Field(None, description="Payment status")
    due_date: Optional[date] = Field(None, description="Due date")
    paid_date: Optional[datetime] = Field(None, description="Payment date")
    description: Optional[str] = Field(None, min_length=1, max_length=500, description="Description")
    category: Optional[str] = Field(None, max_length=20, description="Chart of accounts code (Plano de Contas) - ex: 1.1.01, 2.1.05")
    notes: Optional[str] = Field(None, max_length=2000, description="Notes")
    invoice_number: Optional[str] = Field(None, max_length=100, description="Invoice number")

    class Config:
        json_schema_extra = {
            "example": {
                "payment_status": "pago",
                "paid_date": "2025-11-08T14:30:00",
                "payment_method": "pix",
                "notes": "Pagamento recebido via PIX"
            }
        }


class TransactionMarkAsPaid(BaseModel):
    """Schema for marking a transaction as paid."""

    paid_date: datetime = Field(..., description="Date and time when payment was received")
    payment_method: PaymentMethod = Field(..., description="Payment method used")
    notes: Optional[str] = Field(None, max_length=2000, description="Payment notes")

    class Config:
        json_schema_extra = {
            "example": {
                "paid_date": "2025-11-08T14:30:00",
                "payment_method": "pix",
                "notes": "Pagamento recebido via PIX - comprovante anexado"
            }
        }


class TransactionCancel(BaseModel):
    """Schema for cancelling a transaction."""

    reason: str = Field(..., min_length=5, max_length=500, description="Cancellation reason")

    class Config:
        json_schema_extra = {
            "example": {
                "reason": "Cliente cancelou o contrato antes do vencimento"
            }
        }


# Response schemas
class TransactionResponse(BaseModel):
    """Schema for transaction response."""

    id: UUID
    client_id: UUID
    client_name: Optional[str] = None  # Populated via join
    client_cnpj: Optional[str] = None  # Populated via join
    obligation_id: Optional[UUID]
    transaction_type: TransactionType
    amount: Decimal
    payment_method: Optional[PaymentMethod]
    payment_status: PaymentStatus
    due_date: date
    paid_date: Optional[datetime]
    reference_month: date
    description: str
    category: Optional[str]
    notes: Optional[str]
    invoice_number: Optional[str]
    receipt_url: Optional[str]
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    """Schema for paginated transaction list response."""

    items: list[TransactionResponse]
    total: int
    skip: int
    limit: int


# Fee generation schemas
class MonthlyFeeGenerateRequest(BaseModel):
    """Schema for generating monthly fees."""

    reference_month: date = Field(..., description="Reference month - first day of month")
    client_id: Optional[UUID] = Field(None, description="Generate for specific client (optional)")
    client_ids: Optional[list[UUID]] = Field(
        None,
        description="Generate for a list of specific clients (optional)",
    )

    @field_validator("reference_month")
    def validate_reference_month(cls, v: date) -> date:
        """Ensure reference_month is the first day of a month."""
        if v.day != 1:
            return v.replace(day=1)
        return v

    @field_validator("client_ids")
    def validate_client_ids(cls, v: Optional[list[UUID]]) -> Optional[list[UUID]]:
        """Normalize client_ids removing duplicates while preserving order."""
        if not v:
            return v
        seen: set[UUID] = set()
        deduped: list[UUID] = []
        for item in v:
            if item in seen:
                continue
            seen.add(item)
            deduped.append(item)
        return deduped

    class Config:
        json_schema_extra = {
            "example": {
                "reference_month": "2025-11-01",
                "client_id": None,
                "client_ids": None,
            }
        }


class MonthlyFeeGenerateResponse(BaseModel):
    """Schema for fee generation response."""

    success: bool
    total_clients: int
    total_transactions: int
    reference_month: Optional[date] = None
    created_client_entries: Optional[int] = None
    created_office_entries: Optional[int] = None
    skipped: Optional[int] = None
    errors: int
    message: str


# Financial KPI schemas
class FinancialDashboardKPIs(BaseModel):
    """Schema for financial dashboard KPIs."""

    # Revenue
    total_receita_mes_atual: Decimal = Field(..., description="Total revenue for current month")
    total_receita_mes_anterior: Decimal = Field(..., description="Total revenue for previous month")
    receita_crescimento_percentual: float = Field(..., description="Revenue growth percentage")

    # Receivables
    total_pendente: Decimal = Field(..., description="Total pending payments")
    total_atrasado: Decimal = Field(..., description="Total overdue payments")
    total_pago_mes_atual: Decimal = Field(..., description="Total paid in current month")

    # Counts
    count_pendente: int = Field(..., description="Number of pending transactions")
    count_atrasado: int = Field(..., description="Number of overdue transactions")
    count_pago_mes_atual: int = Field(..., description="Number of paid transactions this month")

    # Top clients
    top_devedores: list[dict] = Field(
        ...,
        description="Top clients with outstanding balance"
    )


class ReceivablesAgingReport(BaseModel):
    """Schema for receivables aging report."""

    class AgingBucket(BaseModel):
        label: str
        count: int
        total_amount: Decimal

    current: AgingBucket  # Not due yet
    days_0_30: AgingBucket  # 0-30 days overdue
    days_31_60: AgingBucket  # 31-60 days overdue
    days_61_90: AgingBucket  # 61-90 days overdue
    days_over_90: AgingBucket  # Over 90 days overdue
    total: Decimal
    total_count: int


class RevenueByPeriodReport(BaseModel):
    """Schema for revenue by period report."""

    class PeriodRevenue(BaseModel):
        period: str  # YYYY-MM format
        receita: Decimal
        despesa: Decimal
        saldo: Decimal

    periods: list[PeriodRevenue]
    total_receita: Decimal
    total_despesa: Decimal
    total_saldo: Decimal


class ClientFinancialSummary(BaseModel):
    """Schema for client financial summary."""

    client_id: UUID
    client_name: str
    client_cnpj: str
    total_pendente: Decimal
    total_atrasado: Decimal
    total_pago: Decimal
    ultimo_pagamento: Optional[datetime]
    proxima_vencimento: Optional[date]
    transactions: list[TransactionResponse]
