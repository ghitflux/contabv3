"""
License schemas for API requests and responses.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LicenseType(str, Enum):
    """Types of licenses and certifications"""
    ALVARA_FUNCIONAMENTO = "alvara_funcionamento"
    INSCRICAO_MUNICIPAL = "inscricao_municipal"
    INSCRICAO_ESTADUAL = "inscricao_estadual"
    CERTIFICADO_DIGITAL = "certificado_digital"
    LICENCA_AMBIENTAL = "licenca_ambiental"
    LICENCA_SANITARIA = "licenca_sanitaria"
    LICENCA_BOMBEIROS = "licenca_bombeiros"
    OUTROS = "outros"


class LicenseStatus(str, Enum):
    """Status of a license"""
    ATIVA = "ativa"
    VENCIDA = "vencida"
    PENDENTE_RENOVACAO = "pendente_renovacao"
    EM_PROCESSO = "em_processo"
    CANCELADA = "cancelada"
    SUSPENSA = "suspensa"


class LicenseEventType(str, Enum):
    """Types of license events"""
    CREATED = "created"
    ISSUED = "issued"
    RENEWED = "renewed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"
    REACTIVATED = "reactivated"
    UPDATED = "updated"
    DOCUMENT_UPLOADED = "document_uploaded"


# License Schemas
class LicenseBase(BaseModel):
    """Base schema for license"""
    client_id: UUID
    license_type: LicenseType
    registration_number: str = Field(..., min_length=1, max_length=100, description="License/registration number")
    issuing_authority: str = Field(..., min_length=1, max_length=200, description="Issuing authority/agency")
    issue_date: date = Field(..., description="Date when license was issued")
    expiration_date: Optional[date] = Field(None, description="Expiration date (if applicable)")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class LicenseCreate(LicenseBase):
    """Schema for creating a new license"""
    pass


class LicenseUpdate(BaseModel):
    """Schema for updating a license"""
    license_type: Optional[LicenseType] = None
    registration_number: Optional[str] = Field(None, min_length=1, max_length=100)
    issuing_authority: Optional[str] = Field(None, min_length=1, max_length=200)
    issue_date: Optional[date] = None
    expiration_date: Optional[date] = None
    status: Optional[LicenseStatus] = None
    notes: Optional[str] = Field(None, max_length=1000)


class LicenseRenewal(BaseModel):
    """Schema for renewing a license"""
    new_issue_date: date = Field(..., description="New issue date")
    new_expiration_date: Optional[date] = Field(None, description="New expiration date")
    new_registration_number: Optional[str] = Field(None, min_length=1, max_length=100, description="New registration number (if changed)")
    notes: Optional[str] = Field(None, max_length=1000, description="Renewal notes")


class LicenseResponse(LicenseBase):
    """Schema for license response"""
    id: UUID
    status: LicenseStatus
    created_at: datetime
    updated_at: datetime

    # Computed fields
    days_until_expiration: Optional[int] = Field(None, description="Days until expiration (negative if expired)")
    is_expired: bool = Field(False, description="Whether license is expired")
    is_expiring_soon: bool = Field(False, description="Whether license expires within 30 days")

    # Related data (optional, populated by eager loading)
    client_name: Optional[str] = None
    document_url: Optional[str] = None

    class Config:
        from_attributes = True


# License Event Schemas
class LicenseEventBase(BaseModel):
    """Base schema for license event"""
    event_type: LicenseEventType
    description: str = Field(..., min_length=1, max_length=500)
    user_id: Optional[UUID] = Field(None, description="User who triggered the event")


class LicenseEventCreate(LicenseEventBase):
    """Schema for creating a license event"""
    license_id: UUID


class LicenseEventResponse(LicenseEventBase):
    """Schema for license event response"""
    id: UUID
    license_id: UUID
    created_at: datetime

    # Related data
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


# List Response
class LicenseListResponse(BaseModel):
    """Schema for paginated license list"""
    items: list[LicenseResponse]
    total: int
    page: int
    size: int
    pages: int


# Statistics
class LicenseStatistics(BaseModel):
    """License statistics for dashboard"""
    total_licenses: int = 0
    active_licenses: int = 0
    expired_licenses: int = 0
    expiring_soon: int = 0  # Within 30 days
    pending_renewal: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)
    by_status: dict[str, int] = Field(default_factory=dict)
