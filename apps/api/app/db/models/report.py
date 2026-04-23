"""Report models - Templates, History, and Scheduling."""

import enum
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDMixin


class ReportType(str, enum.Enum):
    """Type of report to generate."""

    # Strategic reports
    GERAL = "geral"

    # Financial reports
    DRE = "dre"
    FLUXO_CAIXA = "fluxo_caixa"
    LIVRO_CAIXA = "livro_caixa"
    RECEITAS_CLIENTE = "receitas_cliente"
    DESPESAS_CATEGORIA = "despesas_categoria"
    PROJECAO_FLUXO = "projecao_fluxo"
    KPIS = "kpis"

    # Operational reports
    CLIENTES = "clientes"
    OBRIGACOES = "obrigacoes"
    LICENCAS = "licencas"
    AUDITORIA = "auditoria"


class ReportFormat(str, enum.Enum):
    """Export format for reports."""

    PDF = "pdf"
    CSV = "csv"
    XLS = "xls"


class ReportStatus(str, enum.Enum):
    """Status of report generation."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportTemplate(Base, UUIDMixin, TimestampMixin):
    """Report template model - stores reusable report configurations."""

    __tablename__ = "report_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_type: Mapped[ReportType] = mapped_column(
        SQLEnum(
            ReportType,
            name="report_type",
            create_type=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )
    default_filters: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="Default filters for the report"
    )
    default_customizations: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="Default customization options"
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="System templates cannot be modified by users",
    )
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    history_records = relationship("ReportHistory", back_populates="template", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ReportTemplate {self.name} ({self.report_type})>"


class ReportHistory(Base, UUIDMixin):
    """Report history model - tracks generated reports."""

    __tablename__ = "report_history"

    template_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("report_templates.id"), nullable=True, index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    report_type: Mapped[ReportType] = mapped_column(
        SQLEnum(
            ReportType,
            name="report_type",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )
    filters_used: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Filters used when generating this report",
    )
    format: Mapped[ReportFormat] = mapped_column(
        SQLEnum(
            ReportFormat,
            name="report_format",
            create_type=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )
    file_path: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="Path to generated file"
    )
    file_size: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="File size in bytes"
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        index=True,
        comment="Soft delete timestamp for trash/recovery flow",
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="File expiration datetime (default: 7 days after generation)",
    )
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(
            ReportStatus,
            name="report_status",
            create_type=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ReportStatus.PENDING,
        index=True,
    )

    # Relationships
    template = relationship("ReportTemplate", back_populates="history_records")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_report_history_user_report_type", "user_id", "report_type"),
        Index("ix_report_history_generated_at", "generated_at"),
        Index("ix_report_history_user_deleted_at", "user_id", "deleted_at"),
    )

    def __repr__(self) -> str:
        return f"<ReportHistory {self.report_type} {self.status} by user {self.user_id}>"


# Note: ReportSchedule can be implemented in the future for automated report generation
# For now, it's a placeholder in the model structure
