"""
License model for storing licenses and certifications.
"""

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Index, String, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.models.base import Base
from app.schemas.license import LicenseStatus, LicenseType


class License(Base):
    """
    License model.
    Represents a license, certification, or registration for a client.
    """

    __tablename__ = "licenses"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Foreign keys
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Cliente associado",
    )
    # TODO: Add document_id FK when attachments table is implemented
    # document_id = Column(
    #     UUID(as_uuid=True),
    #     ForeignKey("attachments.id", ondelete="SET NULL"),
    #     nullable=True,
    #     comment="Documento anexado",
    # )

    # License details
    license_type = Column(
        Enum(LicenseType),
        nullable=False,
        index=True,
        comment="Tipo de licença",
    )
    registration_number = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Número de registro/licença",
    )
    issuing_authority = Column(
        String(200),
        nullable=False,
        comment="Órgão emissor",
    )
    issue_date = Column(
        Date,
        nullable=False,
        comment="Data de emissão",
    )
    expiration_date = Column(
        Date,
        nullable=True,
        index=True,
        comment="Data de vencimento",
    )
    status = Column(
        Enum(LicenseStatus),
        default=LicenseStatus.EM_PROCESSO,
        nullable=False,
        index=True,
        comment="Status da licença",
    )
    notes = Column(
        Text,
        nullable=True,
        comment="Notas adicionais",
    )

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )

    # Relationships
    client = relationship("Client", back_populates="licenses")
    # TODO: Add document relationship when attachments table is implemented
    # document = relationship("Attachment", foreign_keys=[document_id])
    events = relationship(
        "LicenseEvent",
        back_populates="license",
        cascade="all, delete-orphan",
        order_by="LicenseEvent.created_at.desc()",
    )

    # Indexes
    __table_args__ = (
        Index("ix_licenses_client_type", "client_id", "license_type"),
        Index("ix_licenses_status_expiration", "status", "expiration_date"),
        CheckConstraint(
            "expiration_date IS NULL OR expiration_date > issue_date",
            name="check_expiration_after_issue",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<License(id={self.id}, "
            f"type={self.license_type}, "
            f"number={self.registration_number}, "
            f"status={self.status})>"
        )
