"""
Client schemas for API requests and responses.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from .base import BaseSchema, TimestampSchema


class ClientStatus(str, Enum):
    """Client status enumeration."""

    ATIVO = "ativo"
    INATIVO = "inativo"
    PENDENTE = "pendente"
    INADIMPLENTE = "inadimplente"


class RegimeTributario(str, Enum):
    """Tax regime enumeration."""

    SIMPLES_NACIONAL = "simples_nacional"
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"
    MEI = "mei"


class TipoEmpresa(str, Enum):
    """Company type enumeration."""

    COMERCIO = "comercio"
    SERVICO = "servico"
    INDUSTRIA = "industria"
    FINANCEIRO = "financeiro"


class ClientBase(BaseSchema):
    """Base client schema with common fields."""

    razao_social: str = Field(..., min_length=1, max_length=255)
    nome_fantasia: Optional[str] = Field(None, max_length=255)
    cnpj: str = Field(..., min_length=14, max_length=18)
    inscricao_estadual: Optional[str] = Field(None, max_length=20)
    inscricao_municipal: Optional[str] = Field(None, max_length=20)

    # Contact
    email: EmailStr
    telefone: Optional[str] = Field(None, max_length=20)
    celular: Optional[str] = Field(None, max_length=20)
    user_id: Optional[UUID] = None

    # Address
    cep: Optional[str] = Field(None, max_length=9)
    logradouro: Optional[str] = Field(None, max_length=255)
    numero: Optional[str] = Field(None, max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: Optional[str] = Field(None, max_length=100)
    cidade: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, min_length=2, max_length=2)

    # Financial
    honorarios_mensais: float = Field(..., ge=0)
    dia_vencimento: int = Field(..., ge=1, le=31)
    gerar_lancamentos_honorarios: bool = True

    # Tax info
    regime_tributario: RegimeTributario
    tipo_empresa: TipoEmpresa
    tipos_empresa: Optional[list[str]] = None
    codigo_simples: Optional[str] = Field(None, max_length=50)
    data_abertura: Optional[date] = None
    inicio_escritorio: Optional[date] = None

    # Services and licenses
    servicos_contratados: Optional[list[str]] = None
    licencas_necessarias: Optional[list[str]] = None

    # Obligation types (IDs of ObligationType that apply to this client)
    obligation_types_ids: Optional[list[str]] = None

    # Responsible person
    responsavel_nome: Optional[str] = Field(None, max_length=255)
    responsavel_cpf: Optional[str] = Field(None, max_length=14)
    responsavel_email: Optional[EmailStr] = None
    responsavel_telefone: Optional[str] = Field(None, max_length=20)

    # System access credentials (will be encrypted on backend)
    cpf_empresa: Optional[str] = Field(None, max_length=14)
    senha_sistema: Optional[str] = Field(None, max_length=255)
    senha_gov: Optional[str] = Field(None, max_length=255)
    senha_prefeitura: Optional[str] = Field(None, max_length=255)
    login_seg_desemp: Optional[str] = Field(None, max_length=255)
    senha_seg_desemp: Optional[str] = Field(None, max_length=255)
    email_seg_desemp: Optional[str] = Field(None, max_length=255)
    senha_nfse: Optional[str] = Field(None, max_length=255)
    senha_certificado_digital: Optional[str] = Field(None, max_length=255)
    senha_gcw_resp: Optional[str] = Field(None, max_length=255)

    # Notes
    observacoes: Optional[str] = None

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, v: str) -> str:
        """Validate CNPJ format."""
        # Remove non-numeric characters
        cnpj = "".join(filter(str.isdigit, v))

        if len(cnpj) != 14:
            raise ValueError("CNPJ deve conter 14 dígitos")

        # Format as XX.XXX.XXX/XXXX-XX
        return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"

    @field_validator("uf")
    @classmethod
    def validate_uf(cls, v: Optional[str]) -> Optional[str]:
        """Validate and uppercase UF."""
        return v.upper() if v else None


class ClientCreate(ClientBase):
    """Schema for creating a new client."""

    status: ClientStatus = ClientStatus.ATIVO


class ClientUpdate(BaseSchema):
    """Schema for updating a client."""

    razao_social: Optional[str] = Field(None, min_length=1, max_length=255)
    nome_fantasia: Optional[str] = Field(None, max_length=255)
    cnpj: Optional[str] = Field(None, min_length=14, max_length=18)
    inscricao_estadual: Optional[str] = Field(None, max_length=20)
    inscricao_municipal: Optional[str] = Field(None, max_length=20)

    email: Optional[EmailStr] = None
    telefone: Optional[str] = Field(None, max_length=20)
    celular: Optional[str] = Field(None, max_length=20)

    cep: Optional[str] = Field(None, max_length=9)
    logradouro: Optional[str] = Field(None, max_length=255)
    numero: Optional[str] = Field(None, max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: Optional[str] = Field(None, max_length=100)
    cidade: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, min_length=2, max_length=2)

    honorarios_mensais: Optional[float] = Field(None, ge=0)
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    gerar_lancamentos_honorarios: Optional[bool] = None

    regime_tributario: Optional[RegimeTributario] = None
    tipo_empresa: Optional[TipoEmpresa] = None
    tipos_empresa: Optional[list[str]] = None
    codigo_simples: Optional[str] = Field(None, max_length=50)
    data_abertura: Optional[date] = None
    inicio_escritorio: Optional[date] = None

    # Services and licenses
    servicos_contratados: Optional[list[str]] = None
    licencas_necessarias: Optional[list[str]] = None

    # Obligation types (IDs of ObligationType that apply to this client)
    obligation_types_ids: Optional[list[str]] = None

    responsavel_nome: Optional[str] = Field(None, max_length=255)
    responsavel_cpf: Optional[str] = Field(None, max_length=14)
    responsavel_email: Optional[EmailStr] = None
    responsavel_telefone: Optional[str] = Field(None, max_length=20)

    # System access credentials
    cpf_empresa: Optional[str] = Field(None, max_length=14)
    senha_sistema: Optional[str] = Field(None, max_length=255)
    senha_gov: Optional[str] = Field(None, max_length=255)
    senha_prefeitura: Optional[str] = Field(None, max_length=255)
    login_seg_desemp: Optional[str] = Field(None, max_length=255)
    senha_seg_desemp: Optional[str] = Field(None, max_length=255)
    email_seg_desemp: Optional[str] = Field(None, max_length=255)
    senha_nfse: Optional[str] = Field(None, max_length=255)
    senha_certificado_digital: Optional[str] = Field(None, max_length=255)
    senha_gcw_resp: Optional[str] = Field(None, max_length=255)

    observacoes: Optional[str] = None
    status: Optional[ClientStatus] = None
    user_id: Optional[UUID] = None


class ClientResponse(ClientBase, TimestampSchema):
    """Schema for client response."""

    id: UUID
    status: ClientStatus


class ClientUserCredentials(BaseSchema):
    """Credentials generated for the cliente portal user (returned only on creation)."""

    access: EmailStr
    credential: str


class ClientCreateResult(BaseSchema):
    """Response for client creation including generated access credentials."""

    client: ClientResponse
    credentials: Optional[ClientUserCredentials] = None


class ClientListItem(TimestampSchema):
    """Schema for client list item (simplified)."""

    id: UUID
    razao_social: str
    nome_fantasia: Optional[str]
    cnpj: str
    email: EmailStr
    status: ClientStatus
    honorarios_mensais: float
    regime_tributario: RegimeTributario
    tipo_empresa: TipoEmpresa
    user_id: Optional[UUID] = None

    # Tax info (optional in list view)
    codigo_simples: Optional[str] = None

    # System access credentials (optional in list view)
    cpf_empresa: Optional[str] = None
    senha_sistema: Optional[str] = None
    senha_gov: Optional[str] = None
    senha_prefeitura: Optional[str] = None
    login_seg_desemp: Optional[str] = None
    senha_seg_desemp: Optional[str] = None
    email_seg_desemp: Optional[str] = None
    senha_nfse: Optional[str] = None
    senha_certificado_digital: Optional[str] = None


class ClientDraftCreate(BaseSchema):
    """Schema for saving client form draft (all fields optional)."""

    draft_name: str = Field(..., min_length=1, max_length=100, description="Name for this draft")

    # All client fields are optional in draft
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None
    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    codigo_simples: Optional[str] = None

    email: Optional[str] = None
    telefone: Optional[str] = None
    celular: Optional[str] = None

    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    honorarios_mensais: Optional[float] = None
    dia_vencimento: Optional[int] = None
    gerar_lancamentos_honorarios: Optional[bool] = None

    regime_tributario: Optional[str] = None
    tipo_empresa: Optional[str] = None
    tipos_empresa: Optional[list[str]] = None
    data_abertura: Optional[str] = None
    inicio_escritorio: Optional[str] = None

    responsavel_nome: Optional[str] = None
    responsavel_cpf: Optional[str] = None
    responsavel_email: Optional[str] = None
    responsavel_telefone: Optional[str] = None

    cpf_empresa: Optional[str] = None
    senha_gov: Optional[str] = None
    senha_prefeitura: Optional[str] = None
    login_seg_desemp: Optional[str] = None
    senha_seg_desemp: Optional[str] = None
    email_seg_desemp: Optional[str] = None
    senha_nfse: Optional[str] = None
    senha_certificado_digital: Optional[str] = None
    senha_gcw_resp: Optional[str] = None

    servicos_contratados: Optional[list[str]] = None
    licencas_necessarias: Optional[list[str]] = None

    observacoes: Optional[str] = None
