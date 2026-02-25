"""KPI Report Service - Financial Indicators."""

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.services.report.base import BaseReportService

_ZERO = Decimal("0.00")


def _add_months(reference: date, months: int) -> date:
    """Shift a date to the first day of the month N months away."""
    month_index = (reference.year * 12 + (reference.month - 1)) + months
    year = month_index // 12
    month = (month_index % 12) + 1
    return date(year, month, 1)


def _to_money(value: Decimal) -> float:
    return round(float(value), 2)


def _to_percent(value: Decimal) -> float:
    return round(float(value), 2)


class KPIReportService(BaseReportService):
    """Service for generating Financial KPIs reports."""

    async def _sum_amount(self, conditions: list[Any]) -> Decimal:
        stmt = select(func.sum(FinancialTransaction.amount)).where(and_(*conditions))
        return await self.db.scalar(stmt) or _ZERO

    async def _count_rows(self, conditions: list[Any]) -> int:
        stmt = select(func.count()).where(and_(*conditions))
        return int(await self.db.scalar(stmt) or 0)

    async def _sum_revenue_paid_in_period(
        self,
        base_conditions: list[Any],
        period_start: date,
        period_end: date,
    ) -> Decimal:
        return await self._sum_amount(
            [
                *base_conditions,
                FinancialTransaction.reference_month >= period_start,
                FinancialTransaction.reference_month <= period_end,
                FinancialTransaction.transaction_type == TransactionType.RECEITA,
                FinancialTransaction.payment_status == PaymentStatus.PAGO,
            ]
        )

    async def generate_data(self, filters: dict[str, Any]) -> dict[str, Any]:
        """
        Generate Financial KPIs report data.

        Filters:
            period_start: Start date
            period_end: End date
            client_ids: Optional list of client IDs to filter

        Returns:
            Dictionary with KPI metrics and supporting totals.
        """
        period_start = filters["period_start"].replace(day=1)
        period_end = filters["period_end"].replace(day=1)
        if period_end < period_start:
            period_end = period_start

        client_ids = filters.get("client_ids")

        base_conditions: list[Any] = [FinancialTransaction.deleted_at.is_(None)]
        if client_ids:
            base_conditions.append(FinancialTransaction.client_id.in_(client_ids))

        period_conditions: list[Any] = [
            *base_conditions,
            FinancialTransaction.reference_month >= period_start,
            FinancialTransaction.reference_month <= period_end,
        ]

        revenue_paid_conditions = [
            *period_conditions,
            FinancialTransaction.transaction_type == TransactionType.RECEITA,
            FinancialTransaction.payment_status == PaymentStatus.PAGO,
        ]
        expense_paid_conditions = [
            *period_conditions,
            FinancialTransaction.transaction_type == TransactionType.DESPESA,
            FinancialTransaction.payment_status == PaymentStatus.PAGO,
        ]
        revenue_pending_conditions = [
            *period_conditions,
            FinancialTransaction.transaction_type == TransactionType.RECEITA,
            FinancialTransaction.payment_status == PaymentStatus.PENDENTE,
        ]
        revenue_overdue_conditions = [
            *period_conditions,
            FinancialTransaction.transaction_type == TransactionType.RECEITA,
            FinancialTransaction.payment_status == PaymentStatus.ATRASADO,
        ]
        receivable_conditions = [
            *period_conditions,
            FinancialTransaction.transaction_type == TransactionType.RECEITA,
            FinancialTransaction.payment_status.in_(
                [
                    PaymentStatus.PAGO,
                    PaymentStatus.PENDENTE,
                    PaymentStatus.ATRASADO,
                    PaymentStatus.PARCIAL,
                ]
            ),
        ]

        receita_total = await self._sum_amount(revenue_paid_conditions)
        despesa_total = await self._sum_amount(expense_paid_conditions)
        total_pendente = await self._sum_amount(revenue_pending_conditions)
        total_atrasado = await self._sum_amount(revenue_overdue_conditions)
        total_receber = await self._sum_amount(receivable_conditions)

        total_transacoes = await self._count_rows(receivable_conditions)
        total_transacoes_atrasadas = await self._count_rows(revenue_overdue_conditions)

        clients_stmt = (
            select(func.count(func.distinct(Client.id)))
            .join(FinancialTransaction, Client.id == FinancialTransaction.client_id)
            .where(
                and_(
                    *period_conditions,
                    Client.deleted_at.is_(None),
                )
            )
        )
        total_clientes = int(await self.db.scalar(clients_stmt) or 0)

        resultado_liquido = receita_total - despesa_total

        margem_lucro = (
            (resultado_liquido / receita_total) * Decimal("100")
            if receita_total > _ZERO
            else _ZERO
        )
        percentual_despesas_fixas = (
            (despesa_total / receita_total) * Decimal("100")
            if receita_total > _ZERO
            else _ZERO
        )
        taxa_inadimplencia = (
            (total_atrasado / total_receber) * Decimal("100")
            if total_receber > _ZERO
            else _ZERO
        )
        ticket_medio = (
            receita_total / Decimal(total_clientes)
            if total_clientes > 0
            else _ZERO
        )
        roi = (
            (resultado_liquido / despesa_total) * Decimal("100")
            if despesa_total > _ZERO
            else _ZERO
        )

        # MoM compares current month revenue to previous month revenue.
        current_month = period_end
        previous_month = _add_months(current_month, -1)
        receita_mes_atual = await self._sum_revenue_paid_in_period(
            base_conditions, current_month, current_month
        )
        receita_mes_anterior = await self._sum_revenue_paid_in_period(
            base_conditions, previous_month, previous_month
        )
        crescimento_mom = (
            ((receita_mes_atual - receita_mes_anterior) / receita_mes_anterior)
            * Decimal("100")
            if receita_mes_anterior > _ZERO
            else _ZERO
        )

        # YoY compares the selected period against the same period in the previous year.
        periodo_ano_anterior_inicio = _add_months(period_start, -12)
        periodo_ano_anterior_fim = _add_months(period_end, -12)
        receita_periodo_ano_anterior = await self._sum_revenue_paid_in_period(
            base_conditions,
            periodo_ano_anterior_inicio,
            periodo_ano_anterior_fim,
        )
        crescimento_yoy = (
            ((receita_total - receita_periodo_ano_anterior) / receita_periodo_ano_anterior)
            * Decimal("100")
            if receita_periodo_ano_anterior > _ZERO
            else _ZERO
        )

        return {
            "receita_total": _to_money(receita_total),
            "despesa_total": _to_money(despesa_total),
            "resultado_liquido": _to_money(resultado_liquido),
            "total_pendente": _to_money(total_pendente),
            "total_atrasado": _to_money(total_atrasado),
            "total_receber": _to_money(total_receber),
            "total_clientes": total_clientes,
            "total_transacoes": total_transacoes,
            "total_transacoes_atrasadas": total_transacoes_atrasadas,
            "margem_lucro": _to_percent(margem_lucro),
            "percentual_despesas_fixas": _to_percent(percentual_despesas_fixas),
            "taxa_inadimplencia": _to_percent(taxa_inadimplencia),
            "ticket_medio": _to_money(ticket_medio),
            "crescimento_mom": _to_percent(crescimento_mom),
            "crescimento_yoy": _to_percent(crescimento_yoy),
            "roi": _to_percent(roi),
        }

    def _get_charts_config(self) -> list[dict[str, Any]]:
        """Get chart configurations for KPI report."""
        return [
            {
                "type": "table",
                "title": "Indicadores Financeiros",
                "columns": ["metric", "value"],
            }
        ]

    def _get_summary(self, filters: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        """Generate summary for KPI report."""
        return {
            "period_start": filters["period_start"].isoformat(),
            "period_end": filters["period_end"].isoformat(),
            "receita_total": data.get("receita_total", 0),
            "despesa_total": data.get("despesa_total", 0),
            "resultado_liquido": data.get("resultado_liquido", 0),
            "margem_lucro": data.get("margem_lucro", 0),
            "taxa_inadimplencia": data.get("taxa_inadimplencia", 0),
            "ticket_medio": data.get("ticket_medio", 0),
            "crescimento_mom": data.get("crescimento_mom", 0),
            "crescimento_yoy": data.get("crescimento_yoy", 0),
            "total_clientes": data.get("total_clientes", 0),
            "total_pendente": data.get("total_pendente", 0),
            "total_atrasado": data.get("total_atrasado", 0),
        }

    def _count_records(self, data: dict[str, Any]) -> int:
        """Count total KPI metrics in the report payload."""
        return len(data)

