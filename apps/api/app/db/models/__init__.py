"""Database models."""

# Import all models here to ensure they are registered with Base.metadata
from app.db.models.audit import AuditLog  # noqa: F401
from app.db.models.base import Base  # noqa: F401
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa  # noqa: F401
from app.db.models.client_draft import ClientDraft  # noqa: F401
from app.db.models.cnae import Cnae  # noqa: F401
from app.db.models.finance import FinancialTransaction, PaymentMethod, PaymentStatus, TransactionType  # noqa: F401
from app.db.models.activity import Activity, ActivityPriority, ActivityRecurrence, ActivityStatus  # noqa: F401
from app.db.models.license import License  # noqa: F401
from app.db.models.license_event import LicenseEvent  # noqa: F401
from app.db.models.municipal_registration import MunicipalRegistration  # noqa: F401
from app.db.models.notification import Notification  # noqa: F401
from app.db.models.obligation import Obligation  # noqa: F401
from app.db.models.obligation_event import ObligationEvent  # noqa: F401
from app.db.models.obligation_type import ObligationType  # noqa: F401
from app.db.models.permission import Permission, RolePermission  # noqa: F401
from app.db.models.report import ReportFormat, ReportHistory, ReportStatus, ReportTemplate, ReportType  # noqa: F401
from app.db.models.settings import ClientDefaultSettings, SecuritySettings, SystemSettings, ThemeMode, UserSettings  # noqa: F401
from app.db.models.user import User, UserRole  # noqa: F401

__all__ = [
    "Base",
    "User",
    "UserRole",
    "AuditLog",
    "Client",
    "ClientDraft",
    "ClientStatus",
    "RegimeTributario",
    "TipoEmpresa",
    "Cnae",
    "FinancialTransaction",
    "PaymentMethod",
    "PaymentStatus",
    "TransactionType",
    "Activity",
    "ActivityPriority",
    "ActivityRecurrence",
    "ActivityStatus",
    "License",
    "LicenseEvent",
    "MunicipalRegistration",
    "Notification",
    "Obligation",
    "ObligationEvent",
    "ObligationType",
    "Permission",
    "RolePermission",
    "ReportTemplate",
    "ReportHistory",
    "ReportType",
    "ReportFormat",
    "ReportStatus",
    "SystemSettings",
    "UserSettings",
    "SecuritySettings",
    "ClientDefaultSettings",
    "ThemeMode",
]
