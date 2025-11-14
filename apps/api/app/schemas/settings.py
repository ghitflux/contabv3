"""
Settings schemas for configuration management.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import EmailStr, Field

from .base import BaseSchema, TimestampSchema


class ThemeMode(str, Enum):
    """Theme mode options."""

    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class LanguageCode(str, Enum):
    """Language code options."""

    PT_BR = "pt-br"
    EN_US = "en-us"
    ES_ES = "es-es"


# ======================== SYSTEM SETTINGS ========================


class SystemSettingsBase(BaseSchema):
    """Base system settings schema."""

    company_name: str = Field(..., min_length=1, max_length=255)
    company_cnpj: Optional[str] = Field(None, max_length=18)
    company_email: Optional[EmailStr] = None
    company_phone: Optional[str] = Field(None, max_length=20)
    company_address: Optional[str] = None


class SystemSettingsCreate(SystemSettingsBase):
    """Schema for creating system settings."""

    smtp_host: Optional[str] = Field(None, max_length=255)
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = Field(None, max_length=255)
    smtp_password_encrypted: Optional[str] = None
    smtp_from_email: Optional[EmailStr] = None
    smtp_use_tls: bool = True


class SystemSettingsUpdate(BaseSchema):
    """Schema for updating system settings."""

    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    company_cnpj: Optional[str] = Field(None, max_length=18)
    company_email: Optional[EmailStr] = None
    company_phone: Optional[str] = Field(None, max_length=20)
    company_address: Optional[str] = None
    smtp_host: Optional[str] = Field(None, max_length=255)
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = Field(None, max_length=255)
    smtp_password_encrypted: Optional[str] = None
    smtp_from_email: Optional[EmailStr] = None
    smtp_use_tls: Optional[bool] = None
    backup_enabled: Optional[bool] = None
    backup_frequency: Optional[str] = None
    backup_retention_days: Optional[int] = None
    api_rate_limit_enabled: Optional[bool] = None
    api_rate_limit_requests: Optional[int] = None
    api_rate_limit_window_seconds: Optional[int] = None
    enable_two_factor_auth: Optional[bool] = None
    enable_audit_logging: Optional[bool] = None
    enable_client_drafts: Optional[bool] = None


class SystemSettingsResponse(SystemSettingsBase, TimestampSchema):
    """Schema for system settings response."""

    id: UUID
    smtp_host: Optional[str]
    smtp_port: Optional[int]
    smtp_username: Optional[str]
    smtp_from_email: Optional[EmailStr]
    smtp_use_tls: bool
    backup_enabled: bool
    backup_frequency: Optional[str]
    backup_retention_days: int
    api_rate_limit_enabled: bool
    api_rate_limit_requests: int
    api_rate_limit_window_seconds: int
    enable_two_factor_auth: bool
    enable_audit_logging: bool
    enable_client_drafts: bool


# ======================== USER SETTINGS ========================


class UserSettingsBase(BaseSchema):
    """Base user settings schema."""

    theme_mode: ThemeMode = ThemeMode.SYSTEM
    language: LanguageCode = LanguageCode.PT_BR
    notify_email_enabled: bool = True
    notify_obligations: bool = True
    notify_financial: bool = True
    notify_licenses: bool = True
    notify_reports: bool = False
    notify_system: bool = True


class UserSettingsUpdate(BaseSchema):
    """Schema for updating user settings."""

    theme_mode: Optional[ThemeMode] = None
    language: Optional[LanguageCode] = None
    notify_email_enabled: Optional[bool] = None
    notify_obligations: Optional[bool] = None
    notify_financial: Optional[bool] = None
    notify_licenses: Optional[bool] = None
    notify_reports: Optional[bool] = None
    notify_system: Optional[bool] = None
    email_digest_enabled: Optional[bool] = None
    email_digest_frequency: Optional[str] = None
    show_email_publicly: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None


class UserSettingsResponse(UserSettingsBase, TimestampSchema):
    """Schema for user settings response."""

    id: UUID
    user_id: UUID
    email_digest_enabled: bool
    email_digest_frequency: str
    show_email_publicly: bool
    two_factor_enabled: bool


# ======================== SECURITY SETTINGS ========================


class SecuritySettingsBase(BaseSchema):
    """Base security settings schema."""

    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_numbers: bool = True
    password_require_special_chars: bool = False
    password_expiration_days: Optional[int] = None
    password_history_count: int = 5


class SecuritySettingsUpdate(BaseSchema):
    """Schema for updating security settings."""

    password_min_length: Optional[int] = None
    password_require_uppercase: Optional[bool] = None
    password_require_lowercase: Optional[bool] = None
    password_require_numbers: Optional[bool] = None
    password_require_special_chars: Optional[bool] = None
    password_expiration_days: Optional[int] = None
    password_history_count: Optional[int] = None
    session_timeout_minutes: Optional[int] = None
    max_concurrent_sessions: Optional[int] = None
    require_password_change_on_first_login: Optional[bool] = None
    lockout_enabled: Optional[bool] = None
    lockout_threshold_attempts: Optional[int] = None
    lockout_duration_minutes: Optional[int] = None
    ip_whitelist_enabled: Optional[bool] = None
    two_factor_required: Optional[bool] = None
    two_factor_grace_period_days: Optional[int] = None


class SecuritySettingsResponse(SecuritySettingsBase, TimestampSchema):
    """Schema for security settings response."""

    id: UUID
    session_timeout_minutes: int
    max_concurrent_sessions: int
    require_password_change_on_first_login: bool
    lockout_enabled: bool
    lockout_threshold_attempts: int
    lockout_duration_minutes: int
    ip_whitelist_enabled: bool
    two_factor_required: bool
    two_factor_grace_period_days: int


# ======================== CLIENT DEFAULT SETTINGS ========================


class ClientDefaultSettingsBase(BaseSchema):
    """Base client default settings schema."""

    default_payment_day: int = 10
    default_honorario_amount: Optional[float] = None
    default_obligation_template_ids: Optional[str] = None
    default_cnae_ids: Optional[str] = None
    default_client_status: str = "ativo"


class ClientDefaultSettingsUpdate(BaseSchema):
    """Schema for updating client default settings."""

    default_payment_day: Optional[int] = None
    default_honorario_amount: Optional[float] = None
    default_obligation_template_ids: Optional[str] = None
    default_cnae_ids: Optional[str] = None
    default_client_status: Optional[str] = None
    default_notification_template: Optional[str] = None


class ClientDefaultSettingsResponse(ClientDefaultSettingsBase, TimestampSchema):
    """Schema for client default settings response."""

    id: UUID
    default_notification_template: Optional[str]


# ======================== PERMISSION ========================


class PermissionBase(BaseSchema):
    """Base permission schema."""

    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=100)
    category: str


class PermissionCreate(PermissionBase):
    """Schema for creating a permission."""

    description: Optional[str] = None


class PermissionResponse(PermissionBase):
    """Schema for permission response."""

    id: UUID
    description: Optional[str]


# ======================== ROLE PERMISSIONS ========================


class RolePermissionBase(BaseSchema):
    """Base role permission schema."""

    role: str
    permission_id: UUID
    granted: bool = True


class RolePermissionResponse(RolePermissionBase):
    """Schema for role permission response."""

    pass


class RolePermissionsUpdate(BaseSchema):
    """Schema for updating role permissions."""

    permissions: dict[str, bool] = Field(
        ..., description="Map of permission_id to granted boolean"
    )
