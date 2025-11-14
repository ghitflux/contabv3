"""
Permission models for role-based access control.
"""

from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, Enum as SQLEnum, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDMixin


class PermissionCategory(str, Enum):
    """Permission categories for organization."""

    USERS = "users"
    CLIENTS = "clients"
    FINANCE = "finance"
    OBLIGATIONS = "obligations"
    LICENSES = "licenses"
    REPORTS = "reports"
    SETTINGS = "settings"
    AUDIT = "audit"


class Permission(Base, UUIDMixin, TimestampMixin):
    """Permission model for granular access control."""

    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[PermissionCategory] = mapped_column(
        SQLEnum(PermissionCategory, name="permission_category", create_type=False),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<Permission {self.code}>"


class RolePermission(Base, TimestampMixin):
    """Association between roles and permissions."""

    __tablename__ = "role_permissions"

    role: Mapped[str] = mapped_column(String(50), primary_key=True, nullable=False)  # admin, func, cliente
    permission_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        nullable=False,
        index=True,
    )
    granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint('role', 'permission_id', name='uq_role_permission'),
    )

    def __repr__(self) -> str:
        return f"<RolePermission {self.role}:{self.permission_id}>"
