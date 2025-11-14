"""
Settings models for application configuration.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDMixin


class ThemeMode(str, Enum):
    """User theme preference."""

    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class LanguageCode(str, Enum):
    """Supported languages."""

    PT_BR = "pt-br"
    EN_US = "en-us"
    ES_ES = "es-es"


class SystemSettings(Base, UUIDMixin, TimestampMixin):
    """System-wide configuration settings."""

    __tablename__ = "system_settings"

    # Company Information
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_cnpj: Mapped[Optional[str]] = mapped_column(String(18), nullable=True)
    company_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    company_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Email Configuration
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(nullable=True)
    smtp_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_password_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    smtp_from_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Backup Configuration
    backup_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    backup_frequency: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # daily, weekly, monthly
    backup_retention_days: Mapped[int] = mapped_column(default=30, nullable=False)

    # API Configuration
    api_rate_limit_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    api_rate_limit_requests: Mapped[int] = mapped_column(default=100, nullable=False)
    api_rate_limit_window_seconds: Mapped[int] = mapped_column(default=60, nullable=False)

    # Feature Flags
    enable_two_factor_auth: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    enable_audit_logging: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_client_drafts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<SystemSettings {self.company_name}>"


class UserSettings(Base, UUIDMixin, TimestampMixin):
    """Per-user settings and preferences."""

    __tablename__ = "user_settings"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        index=True,
    )

    # Theme and Localization
    theme_mode: Mapped[str] = mapped_column(
        String(50),
        default=ThemeMode.SYSTEM.value,
        nullable=False,
    )
    language: Mapped[str] = mapped_column(
        String(50),
        default=LanguageCode.PT_BR.value,
        nullable=False,
    )

    # Notification Preferences
    notify_email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_obligations: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_financial: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_licenses: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_reports: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notify_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Email Digest
    email_digest_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_digest_frequency: Mapped[str] = mapped_column(String(50), default="weekly", nullable=False)

    # Privacy
    show_email_publicly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<UserSettings user_id={self.user_id}>"


class SecuritySettings(Base, UUIDMixin, TimestampMixin):
    """System-wide security configuration."""

    __tablename__ = "security_settings"

    # Password Policy
    password_min_length: Mapped[int] = mapped_column(default=8, nullable=False)
    password_require_uppercase: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_require_lowercase: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_require_numbers: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_require_special_chars: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_expiration_days: Mapped[Optional[int]] = mapped_column(nullable=True)  # null = no expiration
    password_history_count: Mapped[int] = mapped_column(default=5, nullable=False)

    # Session Management
    session_timeout_minutes: Mapped[int] = mapped_column(default=30, nullable=False)
    max_concurrent_sessions: Mapped[int] = mapped_column(default=3, nullable=False)
    require_password_change_on_first_login: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Account Lockout
    lockout_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    lockout_threshold_attempts: Mapped[int] = mapped_column(default=5, nullable=False)
    lockout_duration_minutes: Mapped[int] = mapped_column(default=30, nullable=False)

    # IP Whitelist
    ip_whitelist_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Two-Factor Authentication
    two_factor_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_factor_grace_period_days: Mapped[int] = mapped_column(default=7, nullable=False)

    def __repr__(self) -> str:
        return "<SecuritySettings>"


class ClientDefaultSettings(Base, UUIDMixin, TimestampMixin):
    """Default settings for new clients."""

    __tablename__ = "client_default_settings"

    # Default Financial Settings
    default_payment_day: Mapped[int] = mapped_column(default=10, nullable=False)
    default_honorario_amount: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Default Obligations
    default_obligation_template_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array

    # Default CNAEs
    default_cnae_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array

    # Default Status
    default_client_status: Mapped[str] = mapped_column(String(50), default="ativo", nullable=False)

    # Notification Template
    default_notification_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return "<ClientDefaultSettings>"
