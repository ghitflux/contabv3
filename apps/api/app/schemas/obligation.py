"""
Obligation schemas for API requests and responses.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ObligationStatus(str, Enum):
    """Status of an obligation"""
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    CONCLUIDA = "concluida"
    ATRASADA = "atrasada"
    CANCELADA = "cancelada"


class ObligationPriority(str, Enum):
    """Priority levels for obligations"""
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class ObligationRecurrence(str, Enum):
    """Recurrence patterns for obligation types"""
    MENSAL = "mensal"
    BIMESTRAL = "bimestral"
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"
    ANUAL = "anual"


# Obligation Type Schemas
class ObligationTypeBase(BaseModel):
    """Base schema for obligation type"""
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None

    # Applicability filters
    applies_to_commerce: bool = False
    applies_to_service: bool = False
    applies_to_industry: bool = False
    applies_to_mei: bool = False

    applies_to_simples: bool = False
    applies_to_presumido: bool = False
    applies_to_real: bool = False

    # Generation settings
    recurrence: ObligationRecurrence
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    month_of_year: Optional[int] = Field(None, ge=1, le=12)

    is_active: bool = True


class ObligationTypeCreate(ObligationTypeBase):
    """Schema for creating obligation type"""
    pass


class ObligationTypeUpdate(BaseModel):
    """Schema for updating obligation type"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    day_of_month: Optional[int] = Field(None, ge=1, le=31)


class ObligationTypeResponse(ObligationTypeBase):
    """Schema for obligation type response"""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Obligation Schemas
class ObligationBase(BaseModel):
    """Base schema for obligation"""
    client_id: UUID
    obligation_type_id: UUID
    due_date: date
    description: Optional[str] = None
    priority: ObligationPriority = ObligationPriority.MEDIA


class ObligationCreate(ObligationBase):
    """Schema for creating obligation"""
    pass


class ObligationUpdate(BaseModel):
    """Schema for updating obligation"""
    status: Optional[ObligationStatus] = None
    priority: Optional[ObligationPriority] = None
    description: Optional[str] = None
    due_date: Optional[date] = None


class ObligationResponse(ObligationBase):
    """Schema for obligation response"""
    id: UUID
    status: ObligationStatus

    # Client info
    client_name: str
    client_cnpj: str

    # Obligation type info
    obligation_type_name: str
    obligation_type_code: str

    # Completion info
    receipt_url: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by_name: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ObligationListResponse(BaseModel):
    """Schema for paginated obligation list"""
    items: list[ObligationResponse]
    total: int
    skip: int
    limit: int


class ObligationReceiptUpload(BaseModel):
    """Schema for receipt upload"""
    notes: Optional[str] = Field(None, max_length=1000)


class ObligationGenerateRequest(BaseModel):
    """Schema for obligation generation request"""
    year: int = Field(..., ge=2000, le=2100)
    month: int = Field(..., ge=1, le=12)
    client_id: Optional[UUID] = None  # If None, generate for all clients


class ObligationGenerateResponse(BaseModel):
    """Schema for obligation generation response"""
    success: bool = True
    total_clients: Optional[int] = None
    total_obligations: int
    errors: Optional[int] = None
    obligations: Optional[list["ObligationResponse"]] = None


class ObligationReceiptRequest(BaseModel):
    """Schema for receipt upload request"""
    notes: Optional[str] = Field(None, max_length=1000)


class ObligationUpdateDueDateRequest(BaseModel):
    """Schema for updating due date"""
    new_due_date: datetime
    reason: str = Field(..., min_length=1, max_length=500)


class ObligationCancelRequest(BaseModel):
    """Schema for cancelling obligation"""
    reason: str = Field(..., min_length=1, max_length=500)


# Obligation Event Schemas
class ObligationEventBase(BaseModel):
    """Base schema for obligation event"""
    event_type: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1)
    extra_data: Optional[dict] = None


class ObligationEventCreate(ObligationEventBase):
    """Schema for creating obligation event"""
    obligation_id: UUID
    user_id: Optional[UUID] = None


class ObligationEventResponse(ObligationEventBase):
    """Schema for obligation event response"""
    id: UUID
    obligation_id: UUID
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Statistics Schemas
class ObligationStatistics(BaseModel):
    """Schema for obligation statistics"""
    total: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    overdue: int
    due_this_week: int
    due_this_month: int
    completion_rate: float  # Percentage


class ClientObligationSummary(BaseModel):
    """Schema for client obligation summary"""
    client_id: UUID
    client_name: str
    client_cnpj: str
    total_obligations: int
    pending: int
    completed: int
    overdue: int
    next_due_date: Optional[date] = None
