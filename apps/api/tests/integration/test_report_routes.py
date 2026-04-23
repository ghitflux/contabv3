"""
Integration tests for report routes.

Tests the main report endpoints including types, preview, export, and templates.
"""

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.report.enums import ReportType, ReportFormat
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.models.obligation import Obligation
from app.db.models.obligation_type import ObligationType
from app.db.models.user import User
from app.schemas.obligation import ObligationPriority, ObligationRecurrence, ObligationStatus


class TestReportRoutes:
    """Test report API endpoints."""

    @pytest.mark.asyncio
    async def test_get_report_types(self, client: AsyncClient, admin_token: str):
        """Test getting available report types."""
        response = await client.get(
            "/api/v1/reports/types",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        assert len(data["types"]) == 12  # All report types
        assert any(item["type"] == ReportType.GERAL.value for item in data["types"])

        # Check structure of first type
        first_type = data["types"][0]
        assert "type" in first_type
        assert "name" in first_type
        assert "description" in first_type
        assert "category" in first_type

    @pytest.mark.asyncio
    async def test_preview_report_kpi(self, client: AsyncClient, admin_token: str):
        """Test generating a KPI report preview."""
        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.KPIS.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.KPIS.value,
                },
                "customizations": {
                    "include_summary": True,
                    "include_charts": True,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "report_type" in data
        assert data["report_type"] == ReportType.KPIS.value
        assert "summary" in data
        assert "data" in data

    @pytest.mark.asyncio
    async def test_preview_report_geral_has_expected_sections(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        admin_token: str,
    ):
        """Test generating the strategic general report preview."""
        target_client = _build_client("Cliente Geral", "11.111.111/0001-11")
        session.add(target_client)
        await session.flush()
        session.add_all([
            _build_transaction(
                target_client.id,
                admin_user.id,
                TransactionType.RECEITA,
                Decimal("1000.00"),
                "Honorários",
            ),
            _build_transaction(
                target_client.id,
                admin_user.id,
                TransactionType.DESPESA,
                Decimal("400.00"),
                "Despesa operacional",
            ),
            _build_transaction(
                target_client.id,
                admin_user.id,
                TransactionType.APLICACAO,
                Decimal("999.00"),
                "Aplicação financeira",
            ),
            _build_transaction(
                target_client.id,
                admin_user.id,
                TransactionType.RESGATE,
                Decimal("888.00"),
                "Resgate financeiro",
            ),
        ])
        await session.commit()

        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.GERAL.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "client_ids": [str(target_client.id)],
                    "report_type": ReportType.GERAL.value,
                },
                "customizations": {
                    "include_summary": True,
                    "include_charts": True,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert set(data) >= {
            "empresa",
            "resumo_financeiro",
            "dre_simplificada",
            "kpis",
            "evolucao_mensal",
            "analises",
            "projecoes",
        }
        assert data["resumo_financeiro"]["receita_total"] == 1000.0
        assert data["resumo_financeiro"]["despesa_total"] == 400.0
        assert data["resumo_financeiro"]["resultado_liquido"] == 600.0

    @pytest.mark.asyncio
    async def test_cliente_preview_geral_is_scoped_to_own_client(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_user: User,
        cliente_user: User,
        cliente_token: str,
    ):
        """Test client users only receive their own report data."""
        owned_client = _build_client(
            "Cliente Portal",
            "22.222.222/0001-22",
            user_id=cliente_user.id,
        )
        other_client = _build_client("Cliente Outro", "33.333.333/0001-33")
        session.add_all([owned_client, other_client])
        await session.flush()
        session.add_all([
            _build_transaction(
                owned_client.id,
                admin_user.id,
                TransactionType.RECEITA,
                Decimal("300.00"),
                "Receita própria",
            ),
            _build_transaction(
                other_client.id,
                admin_user.id,
                TransactionType.RECEITA,
                Decimal("700.00"),
                "Receita de outro cliente",
            ),
        ])
        await session.commit()

        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {cliente_token}"},
            json={
                "report_type": ReportType.GERAL.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.GERAL.value,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["empresa"]["id"] == str(owned_client.id)
        assert data["resumo_financeiro"]["receita_total"] == 300.0

    @pytest.mark.asyncio
    async def test_preview_report_unauthorized(self, client: AsyncClient):
        """Test preview fails without authorization."""
        response = await client.post(
            "/api/v1/reports/preview",
            json={
                "report_type": ReportType.KPIS.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.KPIS.value,
                },
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_export_report_pdf(self, client: AsyncClient, admin_token: str):
        """Test exporting a report as PDF."""
        response = await client.post(
            "/api/v1/reports/export",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.DRE.value,
                "format": ReportFormat.PDF.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.DRE.value,
                },
                "customizations": {
                    "include_summary": True,
                    "include_charts": False,
                },
                "filename": "teste-dre",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "report_id" in data
        assert "file_name" in data
        assert data["file_name"].endswith(".pdf")
        assert "file_url" in data
        assert "generated_at" in data

    @pytest.mark.asyncio
    async def test_export_report_csv(self, client: AsyncClient, admin_token: str):
        """Test exporting a report as CSV."""
        response = await client.post(
            "/api/v1/reports/export",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.CLIENTES.value,
                "format": ReportFormat.CSV.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.CLIENTES.value,
                },
                "customizations": {
                    "include_summary": False,
                    "include_charts": False,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "report_id" in data
        assert data["file_name"].endswith(".csv")

    @pytest.mark.asyncio
    async def test_client_report_returns_active_and_groupings(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_token: str,
    ):
        """Test clients report includes active totals and grouping by regime/status."""
        active_client = _build_client("Cliente Ativo", "44.444.444/0001-44")
        inactive_client = _build_client(
            "Cliente Inativo",
            "55.555.555/0001-55",
            status=ClientStatus.INATIVO,
            regime=RegimeTributario.LUCRO_PRESUMIDO,
        )
        session.add_all([active_client, inactive_client])
        await session.commit()

        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.CLIENTES.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "client_ids": [str(active_client.id), str(inactive_client.id)],
                    "report_type": ReportType.CLIENTES.value,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["total_clientes"] == 2
        assert data["total_clientes_ativos"] == 1
        assert {item["status"] for item in data["por_status"]} == {"ativo", "inativo"}
        assert {item["regime"] for item in data["por_regime"]} == {
            "lucro_presumido",
            "simples_nacional",
        }

    @pytest.mark.asyncio
    async def test_obligation_report_respects_period_client_and_status(
        self,
        client: AsyncClient,
        session: AsyncSession,
        admin_token: str,
    ):
        """Test obligations report filters by period, client and status."""
        target_client = _build_client("Cliente Obrigação", "66.666.666/0001-66")
        other_client = _build_client("Cliente Fora", "77.777.777/0001-77")
        obligation_type = ObligationType(
            id=uuid4(),
            name="DAS Mensal",
            code="DAS_TEST",
            recurrence=ObligationRecurrence.MENSAL,
        )
        session.add_all([target_client, other_client, obligation_type])
        await session.flush()
        session.add_all([
            Obligation(
                id=uuid4(),
                client_id=target_client.id,
                obligation_type_id=obligation_type.id,
                due_date=date(2025, 1, 20),
                status=ObligationStatus.PENDENTE,
                priority=ObligationPriority.MEDIA,
            ),
            Obligation(
                id=uuid4(),
                client_id=target_client.id,
                obligation_type_id=obligation_type.id,
                due_date=date(2025, 2, 20),
                status=ObligationStatus.PENDENTE,
                priority=ObligationPriority.MEDIA,
            ),
            Obligation(
                id=uuid4(),
                client_id=other_client.id,
                obligation_type_id=obligation_type.id,
                due_date=date(2025, 1, 20),
                status=ObligationStatus.CONCLUIDA,
                priority=ObligationPriority.MEDIA,
            ),
        ])
        await session.commit()

        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.OBRIGACOES.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "client_ids": [str(target_client.id)],
                    "status": "pendente",
                    "report_type": ReportType.OBRIGACOES.value,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["total_obligations"] == 1
        assert data["obligations"][0]["client_id"] == str(target_client.id)
        assert data["obligations"][0]["competencia"] == "2025-01"

    @pytest.mark.asyncio
    async def test_export_report_geral_pdf_csv_history_and_download(
        self,
        client: AsyncClient,
        admin_token: str,
    ):
        """Test exporting general report as PDF and CSV creates downloadable history."""
        report_ids = []
        for report_format in [ReportFormat.PDF.value, ReportFormat.CSV.value]:
            response = await client.post(
                "/api/v1/reports/export",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "report_type": ReportType.GERAL.value,
                    "format": report_format,
                    "filters": {
                        "period_start": "2025-01-01",
                        "period_end": "2025-01-31",
                        "report_type": ReportType.GERAL.value,
                    },
                    "filename": f"teste-geral-{report_format}",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["report_id"]
            assert data["file_url"].endswith(data["report_id"])
            report_ids.append(data["report_id"])

            download_response = await client.get(
                data["file_url"],
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert download_response.status_code == 200

        history_response = await client.get(
            "/api/v1/reports/history?report_type=geral",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert history_response.status_code == 200
        history_ids = {item["id"] for item in history_response.json()["items"]}
        assert set(report_ids).issubset(history_ids)

    @pytest.mark.asyncio
    async def test_list_templates(self, client: AsyncClient, admin_token: str):
        """Test listing report templates."""
        response = await client.get(
            "/api/v1/reports/templates",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200
        templates = response.json()
        assert isinstance(templates, list)

        # After seed, we should have system templates
        if templates:
            first = templates[0]
            assert "id" in first
            assert "name" in first
            assert "report_type" in first
            assert "is_system" in first

    @pytest.mark.asyncio
    async def test_create_template(self, client: AsyncClient, admin_token: str):
        """Test creating a custom template."""
        response = await client.post(
            "/api/v1/reports/templates",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "Template de Teste",
                "description": "Template criado durante teste",
                "report_type": ReportType.KPIS.value,
                "default_filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-12-31",
                    "report_type": ReportType.KPIS.value,
                },
                "default_customizations": {
                    "include_summary": True,
                    "include_charts": True,
                },
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Template de Teste"
        assert data["is_system"] == False
        assert "id" in data

        # Clean up: delete the template
        await client.delete(
            f"/api/v1/reports/templates/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    @pytest.mark.asyncio
    async def test_get_history(self, client: AsyncClient, admin_token: str):
        """Test getting report generation history."""
        # First generate a report
        await client.post(
            "/api/v1/reports/export",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": ReportType.KPIS.value,
                "format": ReportFormat.PDF.value,
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.KPIS.value,
                },
            },
        )

        # Now check history
        response = await client.get(
            "/api/v1/reports/history",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data

        if data["items"]:
            first = data["items"][0]
            assert "id" in first
            assert "report_type" in first
            assert "format" in first
            assert "generated_at" in first

    @pytest.mark.asyncio
    async def test_history_with_filters(self, client: AsyncClient, admin_token: str):
        """Test filtering history by report type."""
        response = await client.get(
            "/api/v1/reports/history?report_type=kpis&format=pdf",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data

        # All returned items should match filters
        for item in data["items"]:
            assert item["report_type"] == "kpis"
            assert item["format"] == "pdf"

    @pytest.mark.asyncio
    async def test_cliente_cannot_access_admin_reports(
        self, client: AsyncClient, cliente_token: str
    ):
        """Test that clients cannot access admin-only reports."""
        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {cliente_token}"},
            json={
                "report_type": ReportType.AUDITORIA.value,  # Admin only
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": ReportType.AUDITORIA.value,
                },
            },
        )

        # Should be forbidden
        assert response.status_code in [403, 401]

    @pytest.mark.asyncio
    async def test_invalid_report_type(self, client: AsyncClient, admin_token: str):
        """Test preview with invalid report type."""
        response = await client.post(
            "/api/v1/reports/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "report_type": "invalid_type",
                "filters": {
                    "period_start": "2025-01-01",
                    "period_end": "2025-01-31",
                    "report_type": "invalid_type",
                },
            },
        )

        assert response.status_code == 422  # Validation error


def _build_client(
    name: str,
    cnpj: str,
    *,
    user_id=None,
    status: ClientStatus = ClientStatus.ATIVO,
    regime: RegimeTributario = RegimeTributario.SIMPLES_NACIONAL,
) -> Client:
    return Client(
        id=uuid4(),
        razao_social=name,
        nome_fantasia=name,
        cnpj=cnpj,
        email=f"{cnpj.replace('.', '').replace('/', '').replace('-', '')}@test.com",
        user_id=user_id,
        honorarios_mensais=Decimal("500.00"),
        dia_vencimento=10,
        regime_tributario=regime,
        tipo_empresa=TipoEmpresa.SERVICO,
        status=status,
    )


def _build_transaction(
    client_id,
    created_by_id,
    transaction_type: TransactionType,
    amount: Decimal,
    description: str,
) -> FinancialTransaction:
    return FinancialTransaction(
        id=uuid4(),
        client_id=client_id,
        created_by_id=created_by_id,
        transaction_type=transaction_type,
        amount=amount,
        payment_status=PaymentStatus.PAGO,
        due_date=date(2025, 1, 10),
        reference_month=date(2025, 1, 1),
        description=description,
    )
