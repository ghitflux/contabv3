"""KPI Report Service - Financial Indicators."""

from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.services.report.base import BaseReportService


class KPIReportService(BaseReportService):
    """Service for generating Financial KPIs reports."""

    async def generate_data(self, filters: dict) -> dict:
        """
        Generate Financial KPIs report data.

        Filters:
            period_start: Start date
            period_end: End date
            client_ids: Optional list of client IDs to filter

        Returns:
            Dictionary with KPI metrics
        """
        period_start = filters["period_start"].replace(day=1)
        period_end = filters["period_end"].replace(day=1)
        client_ids = filters.get("client_ids")

        # Build base conditions
        conditions = [
            FinancialTransaction.deleted_at.is_(None),
        ]

        if client_ids:
            conditions.append(FinancialTransaction.client_id.in_(client_ids))

        # Get current period totals
        current_conditions = [
            *conditions,
            FinancialTransaction.reference_month >= period_start,
            FinancialTransaction.reference_month <= period_end,
        ]

        # Total revenue (received)
        revenue_stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    *current_conditions,
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                    FinancialTransaction.payment_status == PaymentStatus.PAGO,
                )
            )
        )
        receita_total = await self.db.scalar(revenue_stmt) or Decimal("0.00")

        # Total expenses (paid)
        expense_stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    *current_conditions,
                    FinancialTransaction.transaction_type == TransactionType.DESPESA,
                    FinancialTransaction.payment_status == PaymentStatus.PAGO,
                )
            )
        )
        despesa_total = await self.db.scalar(expense_stmt) or Decimal("0.00")

        # Total pending
        pending_stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    *current_conditions,
                    FinancialTransaction.payment_status == PaymentStatus.PENDENTE,
                )
            )
        )
        total_pendente = await self.db.scalar(pending_stmt) or Decimal("0.00")

        # Total overdue
        overdue_stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    *current_conditions,
                    FinancialTransaction.payment_status == PaymentStatus.ATRASADO,
                )
            )
        )
        total_atrasado = await self.db.scalar(overdue_stmt) or Decimal("0.00")

        # Count total transactions
        total_count_stmt = (
            select(func.count())
            .where(and_(*current_conditions))
        )
        total_count = await self.db.scalar(total_count_stmt) or 0

        # Count overdue transactions
        overdue_count_stmt = (
            select(func.count())
            .where(
                and_(
                    *current_conditions,
                    FinancialTransaction.payment_status == PaymentStatus.ATRASADO,
                )
            )
        )
        overdue_count = await self.db.scalar(overdue_count_stmt) or 0

        # Get count of active clients who have transactions
        clients_stmt = (
            select(func.count(func.distinct(Client.id)))
            .join(FinancialTransaction, Client.id == FinancialTransaction.client_id)
            .where(and_(*current_conditions))
        )
        active_clients = await self.db.scalar(clients_stmt) or 0

        # Calculate KPIs
        margem_lucro = (
            float((receita_total - despesa_total) / receita_total * 100)
            if receita_total > 0
            else 0.0
        )

        percentual_despesas_fixas = (
            float(despesa_total / receita_total * 100) if receita_total > 0 else 0.0
        )

        taxa_inadimplencia = (
            float((overdue_count / total_count * 100)) if total_count > 0 else 0.0
        )

        ticket_medio = (
            float(receita_total / active_clients) if active_clients > 0 else 0.0
        )

        # Month-over-month growth
        # Previous month revenue for MoM
        if period_start.month == 1:
            prev_month = date(period_start.year - 1, 12, 1)
        else:
            prev_month = date(period_start.year, period_start.month - 1, 1)

        prev_revenue_stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    *conditions,
                    FinancialTransaction.reference_month == prev_month,
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                    FinancialTransaction.payment_status == PaymentStatus.PAGO,
                )
            )
        )
        prev_receita = await self.db.scalar(prev_revenue_stmt) or Decimal("0.00")

        crescimento_mom = (
            float((receita_total - prev_receita) / prev_receita * 100)
            if prev_receita > 0
            else 0.0
        )

        # Year-over-year growth
        prev_year_month = date(period_start.year - 1, period_start.month, 1)

        prev_year_revenue_stmt = (
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    *conditions,
                    FinancialTransaction.reference_month >= prev_year_month,
                    FinancialTransaction.reference_month <= date(prev_year_month.year, period_end.month, 1),
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                    FinancialTransaction.payment_status == PaymentStatus.PAGO,
                )
            )
        )
        prev_year_receita = await self.db.scalar(prev_year_revenue_stmt) or Decimal("0.00")

        crescimento_yoy = (
            float((receita_total - prev_year_receita) / prev_year_receita * 100)
            if prev_year_receita > 0
            else 0.0
        )

        return {
            "margem_lucro": round(margem_lucro, 2),
            "percentual_despesas_fixas": round(percentual_despesas_fixas, 2),
            "taxa_inadimplencia": round(taxa_inadimplencia, 2),
            "ticket_medio": round(ticket_medio, 2),
            "crescimento_mom": round(crescimento_mom, 2),
            "crescimento_yoy": round(crescimento_yoy, 2),
            "roi": None,  # ROI would require initial investment data
        }

    def _get_charts_config(self) -> list[dict]:
        """Get chart configurations for KPI report."""
        return [
            {
                "type": "table",
                "title": "Indicadores Financeiros",
                "columns": ["metric", "value", "change"],
            }
        ]

    def _get_summary(self, filters: dict, data: dict) -> dict:
        """Generate summary for KPI report."""
        return {
            "period": f"{filters['period_start'].isoformat()} a {filters['period_end'].isoformat()}",
            "key_metrics": data,
        }

    def _count_records(self, data: dict) -> int:
        """Count total records in KPI report (always 7 KPIs)."""
        return 7

