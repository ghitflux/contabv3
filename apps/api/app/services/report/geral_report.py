"""Strategic general report service."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select

from app.core.config import settings
from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.models.settings import SystemSettings
from app.services.report.base import BaseReportService


class GeralReportService(BaseReportService):
    """Service for the strategic management report."""

    async def generate_data(self, filters: dict[str, Any]) -> dict[str, Any]:
        period_start = self._month_start(filters["period_start"])
        period_end = self._month_start(filters["period_end"])
        if period_end < period_start:
            period_end = period_start

        client_ids = filters.get("client_ids")
        base_conditions = [
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.payment_status == PaymentStatus.PAGO,
            FinancialTransaction.reference_month >= period_start,
            FinancialTransaction.reference_month <= period_end,
            FinancialTransaction.transaction_type.in_([
                TransactionType.RECEITA,
                TransactionType.DESPESA,
            ]),
        ]
        if client_ids:
            base_conditions.append(FinancialTransaction.client_id.in_(client_ids))

        monthly_data = await self._get_monthly_data(period_start, period_end, base_conditions)
        categories = await self._get_category_data(base_conditions)

        receita_total = sum((item["receita"] for item in monthly_data), Decimal("0.00"))
        despesa_total = sum((item["despesa"] for item in monthly_data), Decimal("0.00"))
        resultado_liquido = receita_total - despesa_total
        margem_lucro = self._percent(resultado_liquido, receita_total)

        receitas = self._build_category_items(categories.get(TransactionType.RECEITA.value, []), receita_total)
        despesas = self._build_category_items(categories.get(TransactionType.DESPESA.value, []), despesa_total)
        evolucao_mensal = [
            {
                "competencia": item["competencia"],
                "receita_total": float(item["receita"]),
                "despesa_total": float(item["despesa"]),
                "resultado_liquido": float(item["receita"] - item["despesa"]),
                "margem_lucro": self._percent(item["receita"] - item["despesa"], item["receita"]),
            }
            for item in monthly_data
        ]

        resumo_financeiro = {
            "receita_total": float(receita_total),
            "despesa_total": float(despesa_total),
            "resultado_liquido": float(resultado_liquido),
            "margem_lucro": margem_lucro,
        }

        return {
            "empresa": await self._get_company_data(client_ids),
            "resumo_financeiro": resumo_financeiro,
            "dre_simplificada": {
                "receitas": receitas,
                "despesas": despesas,
                **resumo_financeiro,
            },
            "kpis": {
                "margem_operacional": margem_lucro,
                "resultado_liquido": float(resultado_liquido),
                "receita_total": float(receita_total),
                "despesa_total": float(despesa_total),
            },
            "evolucao_mensal": evolucao_mensal,
            "analises": {
                "principais_receitas": receitas[:5],
                "principais_despesas": despesas[:5],
            },
            "projecoes": await self._get_projections(period_end, client_ids),
        }

    async def _get_monthly_data(
        self,
        period_start: date,
        period_end: date,
        conditions: list[Any],
    ) -> list[dict[str, Any]]:
        stmt = (
            select(
                FinancialTransaction.reference_month,
                FinancialTransaction.transaction_type,
                func.sum(FinancialTransaction.amount).label("total"),
            )
            .where(and_(*conditions))
            .group_by(FinancialTransaction.reference_month, FinancialTransaction.transaction_type)
            .order_by(FinancialTransaction.reference_month)
        )
        result = await self.db.execute(stmt)

        by_month: dict[str, dict[str, Decimal]] = {}
        for row in result.all():
            month_key = row.reference_month.strftime("%Y-%m")
            by_month.setdefault(month_key, {
                "receita": Decimal("0.00"),
                "despesa": Decimal("0.00"),
            })
            transaction_type = self._enum_value(row.transaction_type)
            if transaction_type == TransactionType.RECEITA.value:
                by_month[month_key]["receita"] += row.total or Decimal("0.00")
            elif transaction_type == TransactionType.DESPESA.value:
                by_month[month_key]["despesa"] += row.total or Decimal("0.00")

        months = []
        current_month = period_start
        while current_month <= period_end:
            month_key = current_month.strftime("%Y-%m")
            values = by_month.get(month_key, {
                "receita": Decimal("0.00"),
                "despesa": Decimal("0.00"),
            })
            months.append({
                "competencia": month_key,
                "receita": values["receita"],
                "despesa": values["despesa"],
            })
            current_month = self._add_months(current_month, 1)
        return months

    async def _get_category_data(self, conditions: list[Any]) -> dict[str, list[dict[str, Any]]]:
        category_expr = func.coalesce(
            FinancialTransaction.category,
            FinancialTransaction.description,
            "Sem categoria",
        )
        stmt = (
            select(
                FinancialTransaction.transaction_type,
                category_expr.label("categoria"),
                func.sum(FinancialTransaction.amount).label("valor"),
            )
            .where(and_(*conditions))
            .group_by(FinancialTransaction.transaction_type, category_expr)
            .order_by(func.sum(FinancialTransaction.amount).desc())
        )
        result = await self.db.execute(stmt)

        grouped: dict[str, list[dict[str, Any]]] = {
            TransactionType.RECEITA.value: [],
            TransactionType.DESPESA.value: [],
        }
        for row in result.all():
            transaction_type = self._enum_value(row.transaction_type)
            if transaction_type not in grouped:
                continue
            grouped[transaction_type].append({
                "categoria": row.categoria or "Sem categoria",
                "valor": row.valor or Decimal("0.00"),
            })
        return grouped

    async def _get_projections(self, period_end: date, client_ids: list[Any] | None) -> dict[str, Any]:
        history_start = self._add_months(period_end, -5)
        history_conditions = [
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.payment_status == PaymentStatus.PAGO,
            FinancialTransaction.reference_month >= history_start,
            FinancialTransaction.reference_month <= period_end,
            FinancialTransaction.transaction_type.in_([
                TransactionType.RECEITA,
                TransactionType.DESPESA,
            ]),
        ]
        if client_ids:
            history_conditions.append(FinancialTransaction.client_id.in_(client_ids))

        monthly_history = await self._get_monthly_data(history_start, period_end, history_conditions)
        receita_media = sum((item["receita"] for item in monthly_history), Decimal("0.00")) / Decimal("6")
        despesa_media = sum((item["despesa"] for item in monthly_history), Decimal("0.00")) / Decimal("6")

        periods = []
        for offset in range(1, 4):
            projection_month = self._add_months(period_end, offset)
            periods.append({
                "competencia": projection_month.strftime("%Y-%m"),
                "previsao_receita": float(receita_media),
                "previsao_despesa": float(despesa_media),
                "previsao_resultado": float(receita_media - despesa_media),
            })

        return {
            "metodo_projecao": "Média mensal dos últimos 6 meses",
            "base_historico_meses": 6,
            "periodos": periods,
        }

    async def _get_company_data(self, client_ids: list[Any] | None) -> dict[str, Any]:
        system_settings = await self.db.scalar(select(SystemSettings).limit(1))
        client = None
        if client_ids and len(client_ids) == 1:
            client = await self.db.scalar(
                select(Client)
                .where(Client.id == client_ids[0])
                .where(Client.deleted_at.is_(None))
            )

        office_client_id = settings.OFFICE_CLIENT_ID
        is_office_scope = bool(client and office_client_id and client.id == office_client_id)
        if client and not is_office_scope:
            return {
                "escopo": "cliente",
                "id": str(client.id),
                "nome": client.nome_fantasia or client.razao_social,
                "razao_social": client.razao_social,
                "cnpj": client.cnpj,
                "email": client.email,
                "telefone": client.telefone or client.celular,
                "endereco": self._client_address(client),
            }

        scope = "escritorio" if is_office_scope else "consolidado"
        return {
            "escopo": scope,
            "id": str(office_client_id) if is_office_scope and office_client_id else None,
            "nome": (
                system_settings.company_name
                if system_settings
                else client.nome_fantasia if client else "ContabilConsult"
            ),
            "razao_social": client.razao_social if client else None,
            "cnpj": system_settings.company_cnpj if system_settings else client.cnpj if client else None,
            "email": system_settings.company_email if system_settings else client.email if client else None,
            "telefone": system_settings.company_phone if system_settings else client.telefone if client else None,
            "endereco": system_settings.company_address if system_settings else self._client_address(client),
        }

    def _build_category_items(
        self,
        rows: list[dict[str, Any]],
        total: Decimal,
    ) -> list[dict[str, Any]]:
        return [
            {
                "categoria": str(row["categoria"]),
                "valor": float(row["valor"]),
                "percentual": self._percent(row["valor"], total),
            }
            for row in rows
        ]

    def _get_charts_config(self) -> list[dict[str, Any]]:
        return [
            {
                "type": "line",
                "title": "Evolução Mensal",
                "data_key": "evolucao_mensal",
                "x_axis_key": "competencia",
                "series": [
                    {"key": "receita_total", "label": "Receita"},
                    {"key": "despesa_total", "label": "Despesa"},
                    {"key": "resultado_liquido", "label": "Resultado"},
                ],
            },
            {
                "type": "table",
                "title": "Projeções",
                "data_key": "projecoes.periodos",
            },
        ]

    def _get_summary(self, filters: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        resumo = data.get("resumo_financeiro", {})
        return {
            "receita_total": resumo.get("receita_total", 0),
            "despesa_total": resumo.get("despesa_total", 0),
            "resultado_liquido": resumo.get("resultado_liquido", 0),
            "margem_lucro": resumo.get("margem_lucro", 0),
            "margem_operacional": data.get("kpis", {}).get("margem_operacional", 0),
        }

    def _count_records(self, data: dict[str, Any]) -> int:
        return (
            len(data.get("evolucao_mensal", []))
            + len(data.get("analises", {}).get("principais_receitas", []))
            + len(data.get("analises", {}).get("principais_despesas", []))
            + len(data.get("projecoes", {}).get("periodos", []))
        )

    @staticmethod
    def _month_start(value: date | datetime | str) -> date:
        if isinstance(value, str):
            parsed = datetime.fromisoformat(value)
            value = parsed.date()
        elif isinstance(value, datetime):
            value = value.date()
        return value.replace(day=1)

    @staticmethod
    def _add_months(value: date, months: int) -> date:
        month_index = value.month - 1 + months
        year = value.year + month_index // 12
        month = month_index % 12 + 1
        return date(year, month, 1)

    @staticmethod
    def _percent(value: Decimal, total: Decimal) -> float:
        if not total:
            return 0.0
        return round(float(value / total * Decimal("100")), 2)

    @staticmethod
    def _enum_value(value: Any) -> str:
        return value.value if hasattr(value, "value") else str(value)

    @staticmethod
    def _client_address(client: Client | None) -> str | None:
        if not client:
            return None
        parts = [
            client.logradouro,
            client.numero,
            client.bairro,
            client.cidade,
            client.uf,
        ]
        address = ", ".join(str(part) for part in parts if part)
        return address or None
