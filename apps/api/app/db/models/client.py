"""
Client model for customer management.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, Date, Float, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDMixin


class ClientStatus(str, Enum):
    """Client status enum."""

    ATIVO = "ativo"
    INATIVO = "inativo"
    PENDENTE = "pendente"


class RegimeTributario(str, Enum):
    """Tax regime enum."""

    SIMPLES_NACIONAL = "simples_nacional"
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"
    MEI = "mei"


class TipoEmpresa(str, Enum):
    """Company type enum."""

    COMERCIO = "comercio"
    SERVICO = "servico"
    INDUSTRIA = "industria"
    MISTO = "misto"


class Client(Base, UUIDMixin, TimestampMixin):
    """Client model."""

    __tablename__ = "clients"

    # Company info
    razao_social: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    nome_fantasia: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cnpj: Mapped[str] = mapped_column(String(18), unique=True, nullable=False, index=True)
    inscricao_estadual: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    inscricao_municipal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Contact
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    celular: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Address
    cep: Mapped[Optional[str]] = mapped_column(String(9), nullable=True)
    logradouro: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    numero: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    complemento: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bairro: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cidade: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    uf: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)

    # Financial
    honorarios_mensais: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    dia_vencimento: Mapped[int] = mapped_column(Integer, nullable=False)

    # Tax info
    regime_tributario: Mapped[RegimeTributario] = mapped_column(
        ENUM(RegimeTributario, name="regime_tributario", create_type=False),
        nullable=False,
    )
    tipo_empresa: Mapped[TipoEmpresa] = mapped_column(
        ENUM(TipoEmpresa, name="tipo_empresa", create_type=False),
        nullable=False,
    )
    tipos_empresa: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, server_default="[]")
    codigo_simples: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    data_abertura: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    inicio_escritorio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Responsible person
    responsavel_nome: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    responsavel_cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    responsavel_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    responsavel_telefone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # System access credentials (encrypted)
    senha_prefeitura: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    login_seg_desemp: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    senha_seg_desemp: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    senha_gcw_resp: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Services and licenses (JSONB arrays)
    servicos_contratados: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, server_default="[]")
    licencas_necessarias: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, server_default="[]")

    # Notes
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status
    status: Mapped[ClientStatus] = mapped_column(
        ENUM(ClientStatus, name="client_status", create_type=False),
        nullable=False,
        server_default="ATIVO",
    )

    # Soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=None)

    # Relationships
    obligations = relationship("Obligation", back_populates="client", cascade="all, delete-orphan")
    transactions = relationship("FinancialTransaction", back_populates="client", cascade="all, delete-orphan")
    licenses = relationship("License", back_populates="client", cascade="all, delete-orphan")
    cnaes = relationship("Cnae", back_populates="client", cascade="all, delete-orphan")
    municipal_registrations = relationship("MunicipalRegistration", back_populates="client", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Client {self.razao_social} ({self.cnpj})>"

    @property
    def is_deleted(self) -> bool:
        """Check if client is soft deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark client as deleted."""
        from datetime import timezone
        self.deleted_at = datetime.now(timezone.utc)
        self.status = ClientStatus.INATIVO
