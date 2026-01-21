"""Report API routes."""

from datetime import datetime, timedelta
from typing import Annotated, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.report import ReportFormat, ReportType, ReportType as DBReportType
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.db.repositories.report import ReportRepository
from app.schemas.report import (
    ReportCustomization,
    ReportExportRequest,
    ReportFilterRequest,
    ReportHistoryListResponse,
    ReportPreviewRequest,
    ReportPreviewResponse,
    ReportTemplateCreate,
    ReportTemplateResponse,
    ReportTemplateUpdate,
    ReportTypesListResponse,
)
from app.services.report.audit_report import AuditReportService
from app.services.report.cash_book_report import CashBookReportService
from app.services.report.cash_flow_projection_report import CashFlowProjectionReportService
from app.services.report.cash_flow_report import CashFlowReportService
from app.services.report.client_report import ClientReportService
from app.services.report.dre_report import DREReportService
from app.services.report.expenses_by_category_report import ExpensesByCategoryReportService
from app.services.report.exporters.csv_exporter import CSVExporter
from app.services.report.exporters.pdf_exporter import PDFExporter
from app.services.report.kpi_report import KPIReportService
from app.services.report.license_report import LicenseReportService
from app.services.report.obligation_report import ObligationReportService
from app.services.report.revenue_by_client_report import RevenueByClientReportService

router = APIRouter()


async def _enforce_report_access(
    db: AsyncSession,
    current_user: User,
    report_type: ReportType,
    filters: ReportFilterRequest,
) -> None:
    report_type_value = report_type.value if hasattr(report_type, "value") else str(report_type)
    if report_type_value == ReportType.AUDITORIA.value and current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access audit reports",
        )

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        filters.client_ids = [client.id]


# Report type factory
def get_report_service(report_type: ReportType, db: AsyncSession):
    """Factory to get the appropriate report service."""
    services = {
        ReportType.DRE: DREReportService,
        ReportType.FLUXO_CAIXA: CashFlowReportService,
        ReportType.LIVRO_CAIXA: CashBookReportService,
        ReportType.RECEITAS_CLIENTE: RevenueByClientReportService,
        ReportType.DESPESAS_CATEGORIA: ExpensesByCategoryReportService,
        ReportType.PROJECAO_FLUXO: CashFlowProjectionReportService,
        ReportType.KPIS: KPIReportService,
        ReportType.CLIENTES: ClientReportService,
        ReportType.OBRIGACOES: ObligationReportService,
        ReportType.LICENCAS: LicenseReportService,
        ReportType.AUDITORIA: AuditReportService,
    }

    service_class = services.get(report_type)
    if not service_class:
        raise ValueError(f"Unknown report type: {report_type}")

    return service_class(db)


@router.get("/types", response_model=ReportTypesListResponse)
async def list_report_types():
    """List all available report types with metadata."""
    types = [
        {
            "type": "dre",
            "name": "Demonstrativo de Resultados",
            "description": "Mostra o lucro ou prejuízo do período",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["bar", "line", "table"],
            "required_permissions": None,
        },
        {
            "type": "fluxo_caixa",
            "name": "Fluxo de Caixa",
            "description": "Mostra entradas e saídas de dinheiro mês a mês",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["line", "area", "table"],
            "required_permissions": None,
        },
        {
            "type": "livro_caixa",
            "name": "Livro Caixa",
            "description": "Registra todas as movimentações financeiras",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["table"],
            "required_permissions": None,
        },
        {
            "type": "receitas_cliente",
            "name": "Receitas por Cliente",
            "description": "Mostra quanto cada cliente gerou em receita",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["bar", "pie", "table"],
            "required_permissions": None,
        },
        {
            "type": "despesas_categoria",
            "name": "Despesas por Categoria",
            "description": "Classifica despesas em grupos",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["pie", "bar", "table"],
            "required_permissions": None,
        },
        {
            "type": "projecao_fluxo",
            "name": "Projeção de Fluxo de Caixa",
            "description": "Prevê entradas e saídas futuras",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["line", "area", "table"],
            "required_permissions": None,
        },
        {
            "type": "kpis",
            "name": "Indicadores Financeiros",
            "description": "Apresenta métricas de performance",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["table"],
            "required_permissions": None,
        },
        {
            "type": "clientes",
            "name": "Relatório de Clientes",
            "description": "Lista completa de clientes com indicadores",
            "category": "operacional",
            "supports_customization": True,
            "supported_charts": ["table"],
            "required_permissions": None,
        },
        {
            "type": "obrigacoes",
            "name": "Relatório de Obrigações",
            "description": "Compliance e estatísticas de obrigações fiscais",
            "category": "operacional",
            "supports_customization": True,
            "supported_charts": ["bar", "pie", "table"],
            "required_permissions": None,
        },
        {
            "type": "licencas",
            "name": "Relatório de Licenças",
            "description": "Status e vencimentos de licenças",
            "category": "operacional",
            "supports_customization": True,
            "supported_charts": ["table", "bar"],
            "required_permissions": None,
        },
        {
            "type": "auditoria",
            "name": "Relatório de Auditoria",
            "description": "Atividades e mudanças no sistema",
            "category": "operacional",
            "supports_customization": True,
            "supported_charts": ["table", "bar"],
            "required_permissions": ["admin", "func"],
        },
    ]

    return {"types": types}


@router.get("/templates", response_model=list[ReportTemplateResponse])
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    include_system: bool = Query(True),
):
    """List available report templates."""
    repo = ReportRepository(db)
    templates = await repo.get_user_templates(current_user.id, include_system=include_system)
    return templates


@router.post("/templates", response_model=ReportTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    template_data: ReportTemplateCreate,
):
    """Create a new report template."""
    from app.db.models.report import ReportTemplate

    template = ReportTemplate(
        name=template_data.name,
        description=template_data.description,
        report_type=template_data.report_type,
        default_filters=template_data.default_filters,
        default_customizations=template_data.default_customizations,
        is_system=False,
        created_by_id=current_user.id,
    )

    repo = ReportRepository(db)
    created = await repo.create(template)
    return created


@router.put("/templates/{template_id}", response_model=ReportTemplateResponse)
async def update_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    template_data: ReportTemplateUpdate,
):
    """Update a report template (only custom templates)."""
    repo = ReportRepository(db)
    template = await repo.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify system templates"
        )

    # Update fields
    for key, value in template_data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)

    template = await repo.update(template)
    return template


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a report template (only custom templates)."""
    repo = ReportRepository(db)
    template = await repo.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete system templates"
        )

    await repo.delete(template_id)
    return None


@router.post("/preview", response_model=ReportPreviewResponse)
async def preview_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    request: ReportPreviewRequest,
):
    """Generate a preview of the report."""
    await _enforce_report_access(db, current_user, request.report_type, request.filters)

    # Get appropriate service
    service = get_report_service(request.report_type, db)

    # Generate preview
    preview_data = await service.preview(request.filters.model_dump())

    return ReportPreviewResponse(
        report_type=request.report_type,
        data=preview_data["data"],
        charts_config=preview_data.get("charts_config"),
        summary=preview_data.get("summary"),
        generated_at=datetime.utcnow(),
        record_count=preview_data.get("record_count", 0),
    )


@router.post("/export")
async def export_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    request: ReportExportRequest,
):
    """Export report in the specified format."""
    await _enforce_report_access(db, current_user, request.report_type, request.filters)

    # Get appropriate service
    service = get_report_service(request.report_type, db)

    # Generate data
    report_data = await service.generate_data(request.filters.model_dump())

    # Export based on format
    if request.format == ReportFormat.PDF:
        exporter = PDFExporter()
        # Prepare data for PDF export
        pdf_data = {
            "title": f"{request.report_type.replace('_', ' ').title()} Report",
            "period": f"{request.filters.period_start} a {request.filters.period_end}",
            "summary": report_data.get("summary", {}),
            "table_data": _prepare_table_data(report_data),
        }
        file_bytes, file_path = await exporter.export(
            pdf_data, request.filename or f"report_{request.report_type}_{datetime.now().isoformat()}"
        )
    else:  # CSV or XLS
        exporter = CSVExporter()
        csv_data = {
            "title": request.report_type.replace("_", " ").title(),
            "period": f"{request.filters.period_start} a {request.filters.period_end}",
            "summary": report_data,
            "table_data": _prepare_csv_table_data(report_data),
        }
        file_extension = "csv" if request.format == ReportFormat.CSV else "xls"
        desired_name = request.filename or f"report_{request.report_type}_{datetime.now().isoformat()}"
        if not desired_name.endswith(f".{file_extension}"):
            desired_name = f"{desired_name}.{file_extension}"
        file_bytes, file_path = await exporter.export(csv_data, desired_name)

    # Save to history
    repo = ReportRepository(db)
    history = await repo.save_template_history(
        user_id=current_user.id,
        report_type=request.report_type,
        filters_used=request.filters.model_dump(),
        format=request.format,
        file_path=str(file_path),
        file_size=len(file_bytes),
    )

    # Return download info
    return {
        "report_id": history.id,
        "file_url": f"/api/v1/reports/download/{history.id}",
        "file_name": file_path.name,
        "file_size": len(file_bytes),
        "format": request.format,
        "generated_at": history.generated_at,
        "expires_at": history.expires_at,
    }


@router.get("/download/{report_id}")
async def download_report(
    report_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Download a previously generated report."""
    repo = ReportRepository(db)
    history = await repo.get_history_by_id(report_id)

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    # Check ownership
    if history.user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    # Check if expired (handle tz-aware)
    from datetime import timezone

    now = datetime.now(timezone.utc)
    if history.expires_at and history.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Report file has expired"
        )

    if not history.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    media_type = "application/pdf"
    if history.format == ReportFormat.CSV:
        media_type = "text/csv"
    elif history.format == ReportFormat.XLS:
        media_type = "application/vnd.ms-excel"

    return FileResponse(
        history.file_path,
        media_type=media_type,
        filename=history.file_path.split("/")[-1],
    )


@router.get("/history", response_model=ReportHistoryListResponse)
async def get_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    report_type: Optional[ReportType] = Query(None),
    format: Optional[ReportFormat] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Get report generation history."""
    repo = ReportRepository(db)
    history_list, total = await repo.get_history(
        user_id=current_user.id,
        report_type=report_type,
        format=format,
        skip=(page - 1) * size,
        limit=size,
    )

    # Calculate pages
    pages = (total + size - 1) // size if size > 0 else 0

    return {
        "items": history_list,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


def _prepare_table_data(report_data: dict) -> list[list[str]]:
    """Convert report data to table format for PDF."""
    table_data = []

    # Handle different report structures
    if "receitas" in report_data and "despesas" in report_data:
        # DRE format
        table_data.append(["Categoria", "Valor", "%"])
        for item in report_data.get("receitas", []):
            table_data.append([
                item.get("categoria", ""),
                f"R$ {item.get('valor', 0):,.2f}",
                f"{item.get('percentual', 0):.2f}%",
            ])
    elif "periods" in report_data:
        # Cash flow / projection format
        table_data.append(["Período", "Entradas", "Saídas", "Saldo"])
        for item in report_data.get("periods", []):
            table_data.append([
                item.get("periodo", ""),
                f"R$ {item.get('entradas', 0):,.2f}",
                f"R$ {item.get('saidas', 0):,.2f}",
                f"R$ {item.get('saldo_final', 0):,.2f}",
            ])
    elif "clients" in report_data:
        # Revenue by client
        table_data.append(["Cliente", "Receita", "%"])
        for item in report_data.get("clients", []):
            table_data.append([
                item.get("client_name", ""),
                f"R$ {item.get('total_receita', 0):,.2f}",
                f"{item.get('percentual_total', 0):.2f}%",
            ])

    return table_data


def _prepare_csv_table_data(report_data: dict) -> list[list[str]]:
    """Convert report data to CSV table format."""
    return _prepare_table_data(report_data)
