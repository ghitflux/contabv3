"""Activity schemas."""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema


# Request schemas
class ActivityCreate(BaseSchema):
    """Schema for creating an activity."""

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    status: str = Field("todo", pattern="^(todo|in-progress|review|done)$")
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    assigned_to_id: UUID
    due_date: Optional[date] = None
    labels: Optional[list[str]] = None
    recurrence: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")
    reminders: bool = False


class ActivityUpdate(BaseSchema):
    """Schema for updating an activity."""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(todo|in-progress|review|done)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    assigned_to_id: Optional[UUID] = None
    due_date: Optional[date] = None
    labels: Optional[list[str]] = None
    recurrence: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")
    reminders: Optional[bool] = None


# Response schemas
class ActivityResponse(BaseSchema):
    """Schema for activity response."""

    id: UUID
    title: str
    description: Optional[str]
    status: str
    priority: str
    assigned_to_id: UUID
    assigned_to_name: Optional[str] = None
    due_date: Optional[date]
    labels: list[str]
    recurrence: Optional[str]
    reminders: bool
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivityListResponse(BaseSchema):
    """Paginated activity list response."""

    items: list[ActivityResponse]
    total: int
    page: int
    size: int
    pages: int
