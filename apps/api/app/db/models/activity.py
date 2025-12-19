"""Activity model - User tasks and activities."""

import enum
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDMixin


class ActivityStatus(str, enum.Enum):
    """Status of an activity."""

    TODO = "todo"
    IN_PROGRESS = "in-progress"
    REVIEW = "review"
    DONE = "done"


class ActivityPriority(str, enum.Enum):
    """Priority level of an activity."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ActivityRecurrence(str, enum.Enum):
    """Recurrence pattern for activities."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class Activity(Base, UUIDMixin, TimestampMixin):
    """Activity model - represents user tasks and activities."""

    __tablename__ = "activities"

    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ActivityStatus] = mapped_column(
        SQLEnum(
            ActivityStatus,
            name="activity_status",
            create_type=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ActivityStatus.TODO,
        index=True,
    )
    priority: Mapped[ActivityPriority] = mapped_column(
        SQLEnum(
            ActivityPriority,
            name="activity_priority",
            create_type=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ActivityPriority.MEDIUM,
        index=True,
    )
    assigned_to_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    labels: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Comma-separated labels"
    )
    recurrence: Mapped[Optional[ActivityRecurrence]] = mapped_column(
        SQLEnum(
            ActivityRecurrence,
            name="activity_recurrence",
            create_type=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
    )
    reminders: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Enable reminders for this activity"
    )
    created_by_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # Relationships
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<Activity {self.title} ({self.status})>"
