"""Report API routes."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.client import Client
from app.db.models.report import ReportFormat, ReportType
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.db.repositories.report import ReportRepository
from app.schemas.report import (
    ReportCustomization,
    ReportExportRequest,
    ReportFilterRequest,
    ReportHistoryResponse,
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
from app.services.report.geral_report import GeralReportService
from app.services.report.kpi_report import KPIReportService
from app.services.report.license_report import LicenseReportService
from app.services.report.obligation_report import ObligationReportService
from app.services.report.revenue_by_client_report import RevenueByClientReportService

router = APIRouter()

REPORT_DISPLAY_NAMES = {
    ReportType.GERAL: "Relatório Geral",
    ReportType.DRE: "DRE Simplificada",
    ReportType.FLUXO_CAIXA: "Fluxo de Caixa",
    ReportType.LIVRO_CAIXA: "Livro Caixa",
    ReportType.RECEITAS_CLIENTE: "Receitas por Cliente",
    ReportType.DESPESAS_CATEGORIA: "Despesas por Categoria",
    ReportType.PROJECAO_FLUXO: "Projeção de Fluxo de Caixa",
    ReportType.KPIS: "Indicadores Financeiros (KPIs)",
    ReportType.CLIENTES: "Relatório de Clientes",
    ReportType.OBRIGACOES: "Relatório de Obrigações",
    ReportType.LICENCAS: "Relatório de Licenças",
    ReportType.AUDITORIA: "Relatório de Auditoria",
}


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
        if report_type_value == ReportType.CLIENTES.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client users cannot access client portfolio reports",
            )
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
        ReportType.GERAL: GeralReportService,
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
            "type": "geral",
            "name": "Relatório Geral",
            "description": "Visão gerencial com empresa, resumo financeiro, DRE, KPIs, evolução, análises e projeções",
            "category": "financeiro",
            "supports_customization": True,
            "supported_charts": ["line", "bar", "table"],
            "required_permissions": None,
        },
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
    filters_dict = request.filters.model_dump()
    report_data = await service.generate_data(filters_dict)
    period_label = (
        f"{request.filters.period_start.strftime('%d/%m/%Y')} a "
        f"{request.filters.period_end.strftime('%d/%m/%Y')}"
    )
    report_type_value = (
        request.report_type.value
        if hasattr(request.report_type, "value")
        else str(request.report_type)
    )
    try:
        report_type_key = ReportType(report_type_value)
    except ValueError:
        report_type_key = None
    summary_data = service._get_summary(filters_dict, report_data) or _extract_summary_from_report_data(
        report_data
    )
    applied_filters = await _build_applied_filters(db, request.filters)
    report_title = REPORT_DISPLAY_NAMES.get(
        report_type_key, report_type_value.replace("_", " ").title()
    )

    # Export based on format
    if request.format == ReportFormat.PDF:
        exporter = PDFExporter()
        # Prepare data for PDF export
        pdf_data = {
            "report_type": report_type_value,
            "title": report_title,
            "period": period_label,
            "filters": applied_filters,
            "summary": summary_data,
            "table_data": _prepare_table_data(request.report_type, report_data),
        }
        file_bytes, file_path = await exporter.export(
            pdf_data, request.filename or f"report_{request.report_type}_{datetime.now().isoformat()}"
        )
    else:  # CSV or XLS
        exporter = CSVExporter()
        csv_data = {
            "report_type": report_type_value,
            "title": report_title,
            "period": period_label,
            "filters": applied_filters,
            "summary": summary_data,
            "table_data": _prepare_csv_table_data(request.report_type, report_data),
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

    # Check if expired, normalizing both naive and aware datetimes to UTC
    now = datetime.now(timezone.utc)
    if history.expires_at and _normalize_utc_datetime(history.expires_at) < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Report file has expired"
        )

    if not history.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    report_path = Path(history.file_path)
    if not report_path.exists() or not report_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    media_type = "application/pdf"
    if history.format == ReportFormat.CSV:
        media_type = "text/csv"
    elif history.format == ReportFormat.XLS:
        media_type = "application/vnd.ms-excel"

    return FileResponse(
        str(report_path),
        media_type=media_type,
        filename=report_path.name,
    )


@router.delete("/history/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history_item(
    report_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Move a generated report to trash (soft delete)."""
    repo = ReportRepository(db)
    history = await repo.get_history_by_id(report_id, include_deleted=True)

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    # Check ownership
    if history.user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    if history.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report already deleted"
        )

    history.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None


@router.post("/history/{report_id}/restore", response_model=ReportHistoryResponse)
async def restore_history_item(
    report_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Restore a report from trash."""
    repo = ReportRepository(db)
    history = await repo.get_history_by_id(report_id, include_deleted=True)

    if not history or history.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deleted report not found"
        )

    # Check ownership
    if history.user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    now = datetime.now(timezone.utc)
    if history.expires_at and _normalize_utc_datetime(history.expires_at) < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Report file has expired and cannot be restored",
        )

    if not history.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    report_path = Path(history.file_path)
    if not report_path.exists() or not report_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    history.deleted_at = None
    await db.commit()
    await db.refresh(history)
    return history


@router.get("/history", response_model=ReportHistoryListResponse)
async def get_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    report_type: Optional[ReportType] = Query(None),
    format: Optional[ReportFormat] = Query(None),
    include_deleted: bool = Query(False),
    deleted_only: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Get report generation history."""
    if deleted_only:
        include_deleted = True

    repo = ReportRepository(db)
    history_list, total = await repo.get_history(
        user_id=current_user.id,
        report_type=report_type,
        format=format,
        include_deleted=include_deleted,
        deleted_only=deleted_only,
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


async def _build_applied_filters(db: AsyncSession, filters: ReportFilterRequest) -> dict[str, str]:
    """Build human-readable filter labels for export metadata."""
    applied_filters = {
        "Período": (
            f"{filters.period_start.strftime('%d/%m/%Y')} "
            f"a {filters.period_end.strftime('%d/%m/%Y')}"
        )
    }

    if not filters.client_ids:
        applied_filters["Clientes"] = "Todos"
        return applied_filters

    stmt = (
        select(Client.id, Client.razao_social, Client.nome_fantasia, Client.cnpj)
        .where(Client.id.in_(filters.client_ids))
        .where(Client.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    rows = result.all()
    labels_by_id: dict[str, str] = {}

    for row in rows:
        label = row.nome_fantasia or row.razao_social or str(row.id)
        if row.cnpj:
            label = f"{label} ({row.cnpj})"
        labels_by_id[str(row.id)] = label

    applied_filters["Clientes"] = ", ".join(
        labels_by_id.get(str(client_id), str(client_id)) for client_id in filters.client_ids
    )
    return applied_filters


def _extract_summary_from_report_data(report_data: dict) -> dict[str, Any]:
    """Fallback summary when service summary is not available."""
    summary: dict[str, Any] = {}
    summary_fields = [
        "total_entradas",
        "total_saidas",
        "saldo_inicial",
        "saldo_final",
        "saldo_final_periodo",
        "receita_total",
        "despesa_total",
        "resultado_liquido",
        "margem_lucro",
        "percentual_despesas_fixas",
        "taxa_inadimplencia",
        "ticket_medio",
        "crescimento_mom",
        "crescimento_yoy",
        "roi",
        "total_clientes",
        "total_clientes_ativos",
        "total_obligations",
        "compliance_rate",
        "total_transacoes",
        "total_transacoes_atrasadas",
        "total_receber",
        "total_pendente",
        "total_atrasado",
        "total_receita",
        "total_despesas",
        "total_saldo",
    ]

    for field in summary_fields:
        if field in report_data:
            summary[field] = report_data[field]

    if "resumo_financeiro" in report_data:
        summary.update(report_data.get("resumo_financeiro") or {})
    if "kpis" in report_data and "margem_operacional" in report_data["kpis"]:
        summary["margem_operacional"] = report_data["kpis"]["margem_operacional"]
    if "entries" in report_data and "total_lancamentos" not in summary:
        summary["total_lancamentos"] = len(report_data.get("entries", []))
    if "periods" in report_data and "total_periodos" not in summary:
        summary["total_periodos"] = len(report_data.get("periods", []))

    return summary


def _prepare_table_data(report_type: ReportType, report_data: dict) -> list[list[str]]:
    """Convert report data to table format for PDF/CSV."""
    cash_book_type_labels = {
        "entrada": "Entrada",
        "saida": "Saída",
        "aplicacao": "Aplicação",
        "resgate": "Resgate",
    }

    if report_type == ReportType.GERAL:
        table_data = [["Seção", "Indicador", "Valor"]]
        empresa = report_data.get("empresa", {}) or {}
        for key in ["escopo", "nome", "razao_social", "cnpj", "email", "telefone", "endereco"]:
            if empresa.get(key):
                table_data.append(["Empresa", _format_column_name(key), str(empresa.get(key))])

        resumo = report_data.get("resumo_financeiro", {}) or {}
        financial_metrics = [
            ("receita_total", "Receita Total", "currency"),
            ("despesa_total", "Despesa Total", "currency"),
            ("resultado_liquido", "Resultado Líquido", "currency"),
            ("margem_lucro", "Margem de Lucro", "percent"),
        ]
        for key, label, metric_type in financial_metrics:
            if key not in resumo:
                continue
            value = _format_percent(resumo[key]) if metric_type == "percent" else _format_currency(resumo[key])
            table_data.append(["Resumo Financeiro", label, value])

        kpis = report_data.get("kpis", {}) or {}
        if "margem_operacional" in kpis:
            table_data.append(["KPIs", "Margem Operacional", _format_percent(kpis["margem_operacional"])])
        if "resultado_liquido" in kpis:
            table_data.append(["KPIs", "Resultado Líquido", _format_currency(kpis["resultado_liquido"])])

        for item in report_data.get("evolucao_mensal", []):
            table_data.append([
                "Evolução Mensal",
                str(item.get("competencia") or "-"),
                (
                    f"Receita {_format_currency(item.get('receita_total', 0))} | "
                    f"Despesa {_format_currency(item.get('despesa_total', 0))} | "
                    f"Resultado {_format_currency(item.get('resultado_liquido', 0))}"
                ),
            ])

        analises = report_data.get("analises", {}) or {}
        for item in analises.get("principais_receitas", []):
            table_data.append([
                "Principais Receitas",
                str(item.get("categoria") or "-"),
                _format_currency(item.get("valor", 0)),
            ])
        for item in analises.get("principais_despesas", []):
            table_data.append([
                "Principais Despesas",
                str(item.get("categoria") or "-"),
                _format_currency(item.get("valor", 0)),
            ])

        for item in (report_data.get("projecoes", {}) or {}).get("periodos", []):
            table_data.append([
                "Projeções",
                str(item.get("competencia") or "-"),
                (
                    f"Receita {_format_currency(item.get('previsao_receita', 0))} | "
                    f"Despesa {_format_currency(item.get('previsao_despesa', 0))} | "
                    f"Resultado {_format_currency(item.get('previsao_resultado', 0))}"
                ),
            ])
        return table_data

    if report_type == ReportType.KPIS:
        table_data = [["Indicador", "Valor"]]
        metrics: list[tuple[str, str, str]] = [
            ("receita_total", "Receita Total", "currency"),
            ("despesa_total", "Despesa Total", "currency"),
            ("resultado_liquido", "Resultado Líquido", "currency"),
            ("margem_lucro", "Margem de Lucro", "percent"),
            ("percentual_despesas_fixas", "Percentual de Despesas Fixas", "percent"),
            ("taxa_inadimplencia", "Taxa de Inadimplência", "percent"),
            ("ticket_medio", "Ticket Médio", "currency"),
            ("total_receber", "Total a Receber", "currency"),
            ("total_pendente", "Total Pendente", "currency"),
            ("total_atrasado", "Total Atrasado", "currency"),
            ("crescimento_mom", "Crescimento Mês a Mês (MoM)", "percent"),
            ("crescimento_yoy", "Crescimento Ano a Ano (YoY)", "percent"),
            ("roi", "ROI", "percent"),
            ("total_clientes", "Total de Clientes", "count"),
            ("total_transacoes", "Total de Transações", "count"),
            ("total_transacoes_atrasadas", "Transações Atrasadas", "count"),
        ]

        for key, label, metric_type in metrics:
            if key not in report_data:
                continue
            raw_value = report_data.get(key)
            if metric_type == "currency":
                value = _format_currency(raw_value)
            elif metric_type == "percent":
                value = _format_percent(raw_value)
            elif metric_type == "count":
                value = str(int(raw_value or 0))
            else:
                value = str(raw_value if raw_value is not None else "-")
            table_data.append([label, value])

        return table_data

    if report_type == ReportType.CLIENTES and "clients" in report_data:
        table_data = [[
            "Cliente",
            "CNPJ",
            "Status",
            "Regime Tributário",
            "Honorários",
            "Pendente",
            "Atrasado",
        ]]
        for item in report_data.get("clients", []):
            table_data.append([
                str(item.get("nome_fantasia") or item.get("razao_social") or "-"),
                str(item.get("cnpj") or "-"),
                _format_status_label(item.get("status")),
                _format_regime_label(item.get("regime_tributario")),
                _format_currency(item.get("honorarios", 0)),
                _format_currency(item.get("total_pendente", 0)),
                _format_currency(item.get("total_atrasado", 0)),
            ])
        return table_data

    if report_type == ReportType.OBRIGACOES and "obligations" in report_data:
        table_data = [[
            "Cliente",
            "CNPJ",
            "Obrigação",
            "Status",
            "Competência",
            "Vencimento",
            "Prioridade",
        ]]
        for item in report_data.get("obligations", []):
            table_data.append([
                str(item.get("client_name") or "-"),
                str(item.get("client_cnpj") or "-"),
                str(item.get("obligation_name") or "-"),
                _format_status_label(item.get("status")),
                str(item.get("competencia") or "-"),
                _format_date(item.get("due_date")),
                _format_status_label(item.get("priority")),
            ])
        return table_data

    if report_type == ReportType.LIVRO_CAIXA and "entries" in report_data:
        table_data = [[
            "Data",
            "Tipo",
            "Descrição",
            "Cliente",
            "CNPJ",
            "Categoria",
            "Método",
            "Status",
            "Valor",
            "Saldo Acumulado",
        ]]
        for item in report_data.get("entries", []):
            table_data.append([
                _format_date(item.get("data")),
                cash_book_type_labels.get(str(item.get("tipo") or ""), "Saída"),
                str(item.get("descricao") or "-"),
                str(item.get("cliente") or "-"),
                str(item.get("cnpj") or "-"),
                str(item.get("categoria") or "-"),
                _format_payment_method(item.get("metodo_pagamento")),
                _format_payment_status(item.get("status_pagamento")),
                _format_currency(item.get("valor", 0)),
                _format_currency(item.get("saldo_acumulado", 0)),
            ])
        return table_data

    if "receitas" in report_data and "despesas" in report_data:
        table_data = [["Categoria", "Valor", "%"]]
        for item in report_data.get("receitas", []):
            table_data.append([
                str(item.get("categoria") or "-"),
                _format_currency(item.get("valor", 0)),
                _format_percent(item.get("percentual", 0)),
            ])
        return table_data

    if "periods" in report_data:
        periods = report_data.get("periods", [])
        if periods and isinstance(periods[0], dict) and "cenario_otimista" in periods[0]:
            table_data = [["Período", "Cenário Otimista", "Cenário Realista", "Cenário Pessimista"]]
            for item in periods:
                table_data.append([
                    str(item.get("periodo") or item.get("period") or "-"),
                    _format_currency(item.get("cenario_otimista", 0)),
                    _format_currency(item.get("cenario_realista", 0)),
                    _format_currency(item.get("cenario_pessimista", 0)),
                ])
            return table_data

        table_data = [["Período", "Entradas", "Saídas", "Saldo"]]
        for item in periods:
            entradas = item.get("entradas", item.get("receita", 0))
            saidas = item.get("saidas", item.get("despesa", 0))
            saldo = item.get("saldo_final", item.get("saldo", 0))
            table_data.append([
                str(item.get("periodo") or item.get("period") or "-"),
                _format_currency(entradas),
                _format_currency(saidas),
                _format_currency(saldo),
            ])
        return table_data

    if "clients" in report_data:
        table_data = [["Cliente", "CNPJ", "Receita", "%"]]
        for item in report_data.get("clients", []):
            table_data.append([
                str(item.get("client_name") or "-"),
                str(item.get("client_cnpj") or "-"),
                _format_currency(item.get("total_receita", item.get("receita", 0))),
                _format_percent(item.get("percentual_total", item.get("percentual", 0))),
            ])
        return table_data

    if "categories" in report_data:
        table_data = [["Categoria", "Total", "%"]]
        for item in report_data.get("categories", []):
            table_data.append([
                str(item.get("categoria") or "-"),
                _format_currency(item.get("total", 0)),
                _format_percent(item.get("percentual_total", 0)),
            ])
        return table_data

    return _prepare_generic_table(report_data)


def _prepare_csv_table_data(report_type: ReportType, report_data: dict) -> list[list[str]]:
    """Convert report data to CSV table format."""
    return _prepare_table_data(report_type, report_data)


def _prepare_generic_table(report_data: dict) -> list[list[str]]:
    """Fallback table generation for reports with list-of-dict structures."""
    array_key = next(
        (
            key
            for key, value in report_data.items()
            if isinstance(value, list) and value and isinstance(value[0], dict)
        ),
        None,
    )
    if not array_key:
        return []

    rows = report_data[array_key]
    columns = list(rows[0].keys())
    table_data = [[_format_column_name(col) for col in columns]]
    for item in rows:
        table_data.append([_format_cell_value(col, item.get(col)) for col in columns])
    return table_data


def _format_column_name(column: str) -> str:
    return column.replace("_", " ").title()


def _format_cell_value(column: str, value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "Sim" if value else "Não"
    if isinstance(value, (int, float)):
        if any(token in column.lower() for token in ["valor", "total", "saldo", "receita", "despesa"]):
            return _format_currency(value)
        return f"{value:,.2f}" if isinstance(value, float) else str(value)
    if isinstance(value, str) and len(value) >= 10 and value[4:5] == "-" and value[7:8] == "-":
        return _format_date(value)
    return str(value)


def _format_date(value: Any) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.strftime("%d/%m/%Y")
        except ValueError:
            return value
    return str(value)


def _format_currency(value: Any) -> str:
    try:
        numeric = float(value or 0)
    except (TypeError, ValueError):
        return str(value or "-")

    formatted = f"{numeric:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def _format_percent(value: Any) -> str:
    try:
        numeric = float(value or 0)
    except (TypeError, ValueError):
        return str(value or "-")
    return f"{numeric:.2f}%"


def _format_payment_method(value: Any) -> str:
    labels = {
        "pix": "PIX",
        "boleto": "Boleto",
        "transferencia": "Transferência",
        "dinheiro": "Dinheiro",
        "cartao_credito": "Cartão Crédito",
        "cartao_debito": "Cartão Débito",
        "cheque": "Cheque",
    }
    if not value:
        return "-"
    key = str(value).lower()
    return labels.get(key, str(value))


def _format_payment_status(value: Any) -> str:
    labels = {
        "pendente": "Pendente",
        "pago": "Pago",
        "atrasado": "Atrasado",
        "cancelado": "Cancelado",
        "parcial": "Parcial",
    }
    if not value:
        return "-"
    key = str(value).lower()
    return labels.get(key, str(value))


def _format_status_label(value: Any) -> str:
    labels = {
        "ativo": "Ativo",
        "inativo": "Inativo",
        "inadimplente": "Inadimplente",
        "pendente": "Pendente",
        "em_andamento": "Em andamento",
        "concluida": "Concluída",
        "atrasada": "Em atraso",
        "cancelada": "Cancelada",
        "baixa": "Baixa",
        "media": "Média",
        "alta": "Alta",
        "urgente": "Urgente",
    }
    if not value:
        return "-"
    key = str(value).lower()
    return labels.get(key, str(value))


def _format_regime_label(value: Any) -> str:
    labels = {
        "simples_nacional": "Simples Nacional",
        "lucro_presumido": "Lucro Presumido",
        "lucro_real": "Lucro Real",
        "mei": "MEI",
    }
    if not value:
        return "-"
    key = str(value).lower()
    return labels.get(key, str(value))


def _normalize_utc_datetime(value: datetime) -> datetime:
    """Normalize naive/aware datetimes to UTC for safe comparisons."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
