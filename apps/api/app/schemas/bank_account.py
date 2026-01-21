"""Bank account schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BankAccountCreate(BaseModel):
    """Schema for creating a bank account."""

    client_id: Optional[UUID] = Field(None, description="Client UUID (required for admin/func)")
    name: str = Field(..., min_length=1, max_length=255, description="Bank name")
    account_number: str = Field(..., min_length=1, max_length=100, description="Account number")
    balance: Decimal = Field(0, description="Initial balance")
    accounting_account: Optional[str] = Field(None, max_length=50, description="Accounting account")


class BankAccountUpdate(BaseModel):
    """Schema for updating a bank account."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    account_number: Optional[str] = Field(None, min_length=1, max_length=100)
    balance: Optional[Decimal] = Field(None)
    accounting_account: Optional[str] = Field(None, max_length=50)


class BankAccountResponse(BaseModel):
    """Schema for bank account response."""

    id: UUID
    client_id: UUID
    name: str
    account_number: str
    balance: Decimal
    accounting_account: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BankAccountListResponse(BaseModel):
    """Schema for bank account list response."""

    items: list[BankAccountResponse]
    total: int
    skip: int
    limit: int
