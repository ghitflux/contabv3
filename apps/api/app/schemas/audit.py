"""Audit log schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Schema for audit log response."""

    id: UUID
    user_id: Optional[UUID]
    user_name: Optional[str]
    user_email: Optional[str]
    user_role: Optional[str]
    action: str
    entity: str
    entity_id: Optional[str]
    payload: Optional[dict]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """Schema for audit log list response."""

    items: list[AuditLogResponse]
    total: int
    skip: int
    limit: int
