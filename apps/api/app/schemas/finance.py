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


class StatementImportFormat(str, Enum):
    """Supported statement import formats."""

    CSV = "csv"
    OFX = "ofx"
    PDF = "pdf"


# Request schemas
class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""

    client_id: UUID = Field(..., description="Client UUID")
    bank_account_id: Optional[UUID] = Field(None, description="Bank account UUID")
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
    is_recurring: bool = Field(False, description="Whether this launch creates a monthly recurring series")
    recurring_day: Optional[int] = Field(None, ge=1, le=31, description="Day of month for recurring launches")

    @field_validator("reference_month")
    def validate_reference_month(cls, v: date) -> date:
        """Ensure reference_month is the first day of a month."""
        if v.day != 1:
            return v.replace(day=1)
        return v

    @field_validator("recurring_day")
    def validate_recurring_day(cls, v: Optional[int]) -> Optional[int]:
        """Normalize recurring day when provided."""
        if v is None:
            return None
        return max(1, min(31, v))

    class Config:
        json_schema_extra = {
            "example": {
                "client_id": "550e8400-e29b-41d4-a716-446655440000",
                "bank_account_id": None,
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
                "invoice_number": "NF-2025-001",
                "is_recurring": False,
                "recurring_day": None,
            }
        }


class TransactionUpdate(BaseModel):
    """Schema for updating an existing transaction."""

    amount: Optional[Decimal] = Field(None, gt=0, description="Transaction amount")
    bank_account_id: Optional[UUID] = Field(None, description="Bank account UUID")
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
    bank_account_id: Optional[UUID] = None
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
    recurring_template_id: Optional[UUID] = None
    restore_blocked_reason: Optional[str] = None
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


class StatementImportRowResponse(BaseModel):
    """One parsed statement row in the preview."""

    id: UUID
    line_number: int
    transaction_date: date
    description: str
    raw_description: Optional[str] = None
    amount_signed: Decimal
    balance_after: Optional[Decimal] = None
    transaction_type: TransactionType
    confidence: Optional[Decimal] = None
    is_selected: bool
    duplicate_suspected: bool
    duplicate_reason: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    committed_transaction_id: Optional[UUID] = None
    committed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StatementImportPreviewResponse(BaseModel):
    """Persisted statement preview batch."""

    import_id: UUID
    client_id: UUID
    bank_account_id: UUID
    source_format: StatementImportFormat
    status: str
    original_filename: str
    detected_bank_name: Optional[str] = None
    detected_account_number: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    opening_balance: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None
    total_rows: int
    duplicate_rows: int
    imported_rows: int
    total_income: Decimal
    total_expense: Decimal
    rows: list[StatementImportRowResponse]


class StatementImportCommitRow(BaseModel):
    """User decisions for one preview row."""

    row_id: UUID
    is_selected: bool = True
    category: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)


class StatementImportCommitRequest(BaseModel):
    """Commit request for a preview batch."""

    rows: list[StatementImportCommitRow] = Field(..., min_length=1)


class StatementImportCommitResponse(BaseModel):
    """Commit summary for imported transactions."""

    import_id: UUID
    imported_count: int
    skipped_count: int
    duplicate_skipped_count: int
    transaction_ids: list[UUID]


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


class MonthlyFeePreviewClient(BaseModel):
    """Preview details for one client's honorários competence."""

    client_id: UUID
    client_name: str
    client_cnpj: Optional[str] = None
    amount: Decimal
    due_date: Optional[date] = None
    would_create_client_entry: bool
    would_create_office_entry: bool
    existing_client_entry: bool = False
    existing_office_entry: bool = False
    blocked: bool = False
    blocked_reason: Optional[str] = None


class MonthlyFeePreviewResponse(BaseModel):
    """Preview response for monthly honorários generation."""

    total_clients: int
    would_generate_count: int
    would_generate_entries: int
    total_amount: Decimal
    reference_month: date
    blocked_count: int = 0
    has_more: bool = False
    clients: list[MonthlyFeePreviewClient]


class TransactionBulkIdsRequest(BaseModel):
    """Base request for bulk transaction operations."""

    transaction_ids: list[UUID] = Field(..., min_length=1, description="Transactions to process")

    @field_validator("transaction_ids")
    def validate_transaction_ids(cls, v: list[UUID]) -> list[UUID]:
        """Remove duplicates while preserving order."""
        seen: set[UUID] = set()
        deduped: list[UUID] = []
        for item in v:
            if item in seen:
                continue
            seen.add(item)
            deduped.append(item)
        return deduped


class TransactionBulkPayRequest(TransactionBulkIdsRequest):
    """Bulk baixa payload."""

    paid_date: Optional[datetime] = Field(None, description="Baixa date/time, defaults to now")
    payment_method: PaymentMethod = Field(
        PaymentMethod.TRANSFERENCIA,
        description="Payment method used for baixa",
    )
    notes: Optional[str] = Field(None, max_length=2000, description="Optional baixa notes")


class TransactionBulkOperationItem(BaseModel):
    """Per-item bulk operation outcome."""

    transaction_id: UUID
    success: bool
    detail: Optional[str] = None


class TransactionBulkOperationResponse(BaseModel):
    """Summary for bulk transaction operations."""

    success: bool
    action: str
    requested: int
    processed: int
    succeeded: int
    failed: int
    items: list[TransactionBulkOperationItem]


class TransactionTrashPurgeResponse(BaseModel):
    """Summary for permanent trash cleanup."""

    success: bool
    deleted: int


class MonthlyFeeBulkDeleteRequest(BaseModel):
    """Bulk delete honorários payload."""

    office_transaction_ids: list[UUID] = Field(
        ...,
        min_length=1,
        description="Office honorários revenue transactions to delete in pair",
    )
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Reason stored in block metadata",
    )

    @field_validator("office_transaction_ids")
    def validate_office_transaction_ids(cls, v: list[UUID]) -> list[UUID]:
        """Remove duplicates while preserving order."""
        seen: set[UUID] = set()
        deduped: list[UUID] = []
        for item in v:
            if item in seen:
                continue
            seen.add(item)
            deduped.append(item)
        return deduped


class MonthlyFeeBulkDeleteItem(BaseModel):
    """Per-item result for honorários pair delete."""

    office_transaction_id: UUID
    client_id: Optional[UUID] = None
    reference_month: Optional[date] = None
    success: bool
    deleted_office_entry: bool = False
    deleted_client_entry: bool = False
    blocked: bool = False
    detail: Optional[str] = None


class MonthlyFeeBulkDeleteResponse(BaseModel):
    """Summary for honorários pair delete."""

    success: bool
    requested: int
    succeeded: int
    failed: int
    blocked_competences: int
    items: list[MonthlyFeeBulkDeleteItem]


class MonthlyFeePairUpdate(BaseModel):
    """Editable fields for an automatic honorários pair."""

    amount: Optional[Decimal] = Field(None, gt=0, description="Fee amount")
    due_date: Optional[date] = Field(None, description="Due date for both mirrored entries")
    payment_method: Optional[PaymentMethod] = Field(
        None,
        description="Payment method mirrored on both entries",
    )
    paid_date: Optional[datetime] = Field(
        None,
        description="Paid date mirrored on both entries; null reopens the pair",
    )
    notes: Optional[str] = Field(None, max_length=2000, description="User notes")
    invoice_number: Optional[str] = Field(None, max_length=100, description="Invoice number")


class MonthlyFeePairResponse(BaseModel):
    """Operation response for one automatic honorários pair."""

    success: bool
    client_id: UUID
    reference_month: date
    office_transaction: TransactionResponse
    client_transaction: Optional[TransactionResponse] = None
    blocked_competence: bool = False
    detail: Optional[str] = None


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
