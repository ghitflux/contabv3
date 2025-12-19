"""Report schemas - Pydantic models for API contracts."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import BaseSchema


# Enums
class ReportType(str, Enum):
    """Type of report to generate."""

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


class ReportFormat(str, Enum):
    """Export format for reports."""

    PDF = "pdf"
    CSV = "csv"
    XLS = "xls"


class ReportStatus(str, Enum):
    """Status of report generation."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class ChartType(str, Enum):
    """Type of chart for visualization."""

    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    DONUT = "donut"
    AREA = "area"
    TABLE = "table"


# Request schemas
class ReportFilterRequest(BaseSchema):
    """Base schema for report filters."""

    period_start: date = Field(..., description="Start date of the period")
    period_end: date = Field(..., description="End date of the period")
    client_ids: Optional[list[UUID]] = Field(None, description="Filter by specific clients")
    report_type: ReportType = Field(..., description="Type of report to generate")

    @field_validator("period_end")
    def validate_period(cls, v: date, info) -> date:
        """Ensure period_end is after period_start."""
        if "period_start" in info.data and v < info.data["period_start"]:
            raise ValueError("period_end must be after period_start")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "period_start": "2025-01-01",
                "period_end": "2025-12-31",
                "client_ids": None,
                "report_type": "dre",
            }
        }


class ReportCustomization(BaseSchema):
    """Schema for report customization options."""

    fields_to_include: Optional[list[str]] = Field(
        None, description="Specific fields to include in the report"
    )
    group_by: Optional[str] = Field(None, description="Field to group data by")
    sort_by: Optional[str] = Field(None, description="Field to sort by")
    sort_direction: Optional[str] = Field("asc", description="Sort direction (asc/desc)")
    chart_types: Optional[list[ChartType]] = Field(
        None, description="Types of charts to include"
    )
    include_summary: bool = Field(True, description="Include summary section")
    include_charts: bool = Field(True, description="Include charts/visualizations")

    class Config:
        json_schema_extra = {
            "example": {
                "fields_to_include": ["data", "valor", "cliente"],
                "group_by": "cliente",
                "sort_by": "valor",
                "sort_direction": "desc",
                "chart_types": ["bar", "pie"],
                "include_summary": True,
                "include_charts": True,
            }
        }


class ReportPreviewRequest(BaseSchema):
    """Request schema for generating report preview."""

    report_type: ReportType = Field(..., description="Type of report")
    filters: ReportFilterRequest = Field(..., description="Report filters")
    customizations: Optional[ReportCustomization] = Field(
        None, description="Customization options"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "report_type": "dre",
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-12-31",
                    "client_ids": None,
                    "report_type": "dre",
                },
                "customizations": {
                    "include_summary": True,
                    "include_charts": True,
                },
            }
        }


class ReportExportRequest(BaseSchema):
    """Request schema for exporting report."""

    report_type: ReportType = Field(..., description="Type of report")
    format: ReportFormat = Field(..., description="Export format")
    filters: ReportFilterRequest = Field(..., description="Report filters")
    customizations: Optional[ReportCustomization] = Field(
        None, description="Customization options"
    )
    filename: Optional[str] = Field(None, max_length=200, description="Custom filename")
    save_as_template: bool = Field(False, description="Save as reusable template")

    class Config:
        json_schema_extra = {
            "example": {
                "report_type": "dre",
                "format": "pdf",
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-12-31",
                    "client_ids": None,
                    "report_type": "dre",
                },
                "customizations": None,
                "filename": "DRE_2025",
                "save_as_template": False,
            }
        }


# Response schemas
class ReportPreviewResponse(BaseSchema):
    """Response schema for report preview."""

    report_type: ReportType
    data: dict[str, Any] = Field(..., description="Report data")
    charts_config: Optional[list[dict[str, Any]]] = Field(
        None, description="Chart configuration"
    )
    summary: Optional[dict[str, Any]] = Field(None, description="Report summary")
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    record_count: int = Field(..., description="Number of records in the report")


class ReportExportResponse(BaseSchema):
    """Response schema for report export."""

    report_id: UUID = Field(..., description="Report history ID")
    file_url: str = Field(..., description="URL to download the file")
    file_name: str = Field(..., description="Generated filename")
    file_size: int = Field(..., description="File size in bytes")
    format: ReportFormat
    generated_at: datetime
    expires_at: datetime = Field(..., description="File expiration datetime")


class ChartConfig(BaseSchema):
    """Configuration for a chart."""

    type: ChartType
    title: str
    data_key: str
    x_axis_key: Optional[str] = None
    y_axis_key: Optional[str] = None
    color_scheme: Optional[list[str]] = None


# Template schemas
class ReportTemplateCreate(BaseSchema):
    """Schema for creating a report template."""

    name: str = Field(..., min_length=1, max_length=200, description="Template name")
    description: Optional[str] = Field(None, max_length=500, description="Description")
    report_type: ReportType = Field(..., description="Type of report")
    default_filters: dict[str, Any] = Field(..., description="Default filters")
    default_customizations: Optional[dict[str, Any]] = Field(
        None, description="Default customizations"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "DRE Mensal",
                "description": "Demonstrativo de Resultados mensal padrão",
                "report_type": "dre",
                "default_filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-12-31",
                },
                "default_customizations": {
                    "include_summary": True,
                    "include_charts": True,
                },
            }
        }


class ReportTemplateUpdate(BaseSchema):
    """Schema for updating a report template."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    default_filters: Optional[dict[str, Any]] = None
    default_customizations: Optional[dict[str, Any]] = None


class ReportTemplateResponse(BaseSchema):
    """Schema for report template response."""

    id: UUID
    name: str
    description: Optional[str]
    report_type: ReportType
    default_filters: dict[str, Any]
    default_customizations: Optional[dict[str, Any]]
    is_system: bool
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# History schemas
class ReportHistoryResponse(BaseSchema):
    """Schema for report history response."""

    id: UUID
    template_id: Optional[UUID]
    user_id: UUID
    report_type: ReportType
    filters_used: dict[str, Any]
    format: ReportFormat
    file_path: Optional[str]
    file_size: Optional[int]
    generated_at: datetime
    expires_at: Optional[datetime]
    status: ReportStatus

    class Config:
        from_attributes = True


class ReportHistoryListResponse(BaseSchema):
    """Paginated report history response."""

    items: list[ReportHistoryResponse]
    total: int
    page: int
    size: int
    pages: int


# Report type info
class ReportTypeInfo(BaseSchema):
    """Information about a report type."""

    type: ReportType
    name: str
    description: str
    category: str  # "financeiro" or "operacional"
    supports_customization: bool
    supported_charts: list[ChartType]
    required_permissions: Optional[list[str]] = None


class ReportTypesListResponse(BaseSchema):
    """List of available report types."""

    types: list[ReportTypeInfo]


# Financial report specific schemas
class DREReportData(BaseSchema):
    """DRE Report data structure."""

    class DRERow(BaseSchema):
        categoria: str
        valor: Decimal
        percentual: Optional[float] = None

    receitas: list[DRERow] = Field(..., description="Revenue items")
    despesas: list[DRERow] = Field(..., description="Expense items")
    receita_total: Decimal
    despesa_total: Decimal
    resultado_liquido: Decimal
    margem_lucro: float


class CashFlowReportData(BaseSchema):
    """Cash Flow Report data structure."""

    class CashFlowPeriod(BaseSchema):
        periodo: str  # YYYY-MM
        entradas: Decimal
        saidas: Decimal
        saldo_inicial: Decimal
        saldo_final: Decimal

    periods: list[CashFlowPeriod]
    total_entradas: Decimal
    total_saidas: Decimal
    saldo_final_periodo: Decimal


class CashBookReportData(BaseSchema):
    """Cash Book Report data structure."""

    class CashBookEntry(BaseSchema):
        data: date
        tipo: str  # "entrada" or "saida"
        descricao: str
        valor: Decimal
        saldo_acumulado: Decimal

    entries: list[CashBookEntry]
    saldo_inicial: Decimal
    saldo_final: Decimal
    total_entradas: Decimal
    total_saidas: Decimal


class RevenueByClientReportData(BaseSchema):
    """Revenue by Client Report data structure."""

    class ClientRevenue(BaseSchema):
        client_id: UUID
        client_name: str
        client_cnpj: Optional[str]
        total_receita: Decimal
        percentual_total: float

    clients: list[ClientRevenue]
    total_receita: Decimal


class ExpensesByCategoryReportData(BaseSchema):
    """Expenses by Category Report data structure."""

    class CategoryExpense(BaseSchema):
        categoria: str
        total: Decimal
        percentual_total: float

    categories: list[CategoryExpense]
    total_despesas: Decimal


class CashFlowProjectionReportData(BaseSchema):
    """Cash Flow Projection Report data structure."""

    class ProjectionPeriod(BaseSchema):
        periodo: str  # YYYY-MM
        cenario_otimista: Decimal
        cenario_realista: Decimal
        cenario_pessimista: Decimal

    periods: list[ProjectionPeriod]
    metodo_projecao: str
    base_historico_meses: int


class KPIReportData(BaseSchema):
    """Financial KPIs Report data structure."""

    margem_lucro: float = Field(..., description="Profit margin %")
    percentual_despesas_fixas: float = Field(..., description="Fixed expenses % of revenue")
    taxa_inadimplencia: float = Field(..., description="Default rate %")
    ticket_medio: Decimal = Field(..., description="Average ticket per client")
    crescimento_mom: float = Field(..., description="Month-over-month growth %")
    crescimento_yoy: float = Field(..., description="Year-over-year growth %")
    roi: Optional[float] = Field(None, description="Return on investment %")


# Operational report schemas
class ClientsReportData(BaseSchema):
    """Clients Report data structure."""

    class ClientInfo(BaseSchema):
        id: UUID
        razao_social: str
        cnpj: str
        email: Optional[str]
        status: str
        honorarios: Decimal
        total_pendente: Decimal
        total_atrasado: Decimal

    clients: list[ClientInfo]
    total_clientes: int
    total_honorarios: Decimal


class ObligationsReportData(BaseSchema):
    """Obligations Report data structure."""

    compliance_rate: float = Field(..., description="% of obligations completed on time")
    total_obligations: int
    pending: int
    completed: int
    overdue: int
    cancelled: int


class LicensesReportData(BaseSchema):
    """Licenses Report data structure."""

    total_licenses: int
    active: int
    expiring_soon: int  # < 30 days
    expired: int
    renewals_in_period: int


class AuditReportData(BaseSchema):
    """Audit Report data structure."""

    total_actions: int
    actions_by_user: dict[str, int]
    actions_by_module: dict[str, int]
    actions_by_type: dict[str, int]
