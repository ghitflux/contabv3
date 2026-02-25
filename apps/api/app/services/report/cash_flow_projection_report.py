"""Cash Flow Projection Report Service."""

from datetime import date, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.services.report.base import BaseReportService


class CashFlowProjectionReportService(BaseReportService):
    """Service for generating Cash Flow Projection reports."""

    async def generate_data(self, filters: dict) -> dict:
        """
        Generate Cash Flow Projection report data based on historical data.

        Filters:
            period_start: Start date
            period_end: End date
            client_ids: Optional list of client IDs to filter

        Returns:
            Dictionary with projection data for multiple scenarios
        """
        period_start = filters["period_start"].replace(day=1)
        period_end = filters["period_end"].replace(day=1)
        client_ids = filters.get("client_ids")

        # Get historical data from last 6 months
        historical_start = period_start - timedelta(days=180)

        # Get historical averages for receipts and disbursements
        conditions = [
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.reference_month >= historical_start.replace(day=1),
            FinancialTransaction.reference_month < period_start.replace(day=1),
            FinancialTransaction.payment_status == PaymentStatus.PAGO,
        ]
        if client_ids:
            conditions.append(FinancialTransaction.client_id.in_(client_ids))

        # Calculate monthly totals and derive average monthly revenue
        revenue_stmt = (
            select(
                FinancialTransaction.reference_month,
                func.sum(FinancialTransaction.amount).label("total"),
            )
            .where(
                and_(
                    *conditions,
                    FinancialTransaction.transaction_type == TransactionType.RECEITA,
                )
            )
            .group_by(FinancialTransaction.reference_month)
        )
        revenue_result = await self.db.execute(revenue_stmt)
        avg_revenue_rows = revenue_result.all()
        revenue_values = [float(row.total or 0) for row in avg_revenue_rows]
        avg_revenue = (
            sum(revenue_values) / len(revenue_values)
            if revenue_values else 0.0
        )

        # Calculate monthly totals and derive average monthly expenses
        expense_stmt = (
            select(
                FinancialTransaction.reference_month,
                func.sum(FinancialTransaction.amount).label("total"),
            )
            .where(
                and_(
                    *conditions,
                    FinancialTransaction.transaction_type == TransactionType.DESPESA,
                )
            )
            .group_by(FinancialTransaction.reference_month)
        )
        expense_result = await self.db.execute(expense_stmt)
        avg_expense_rows = expense_result.all()
        expense_values = [float(row.total or 0) for row in avg_expense_rows]
        avg_expense = (
            sum(expense_values) / len(expense_values)
            if expense_values else 0.0
        )

        # Generate projections for next 3 months
        periods = []
        current_month = period_start

        # Only project if we have data
        project_months = min(3, (period_end.year - period_start.year) * 12 + period_end.month - period_start.month + 1)

        for i in range(project_months):
            # Optimistic: +20%
            cenario_otimista = (avg_revenue - avg_expense) * 1.2

            # Realistic: average
            cenario_realista = avg_revenue - avg_expense

            # Pessimistic: -20%
            cenario_pessimista = (avg_revenue - avg_expense) * 0.8

            periods.append({
                "periodo": current_month.strftime("%Y-%m"),
                "cenario_otimista": round(cenario_otimista, 2),
                "cenario_realista": round(cenario_realista, 2),
                "cenario_pessimista": round(cenario_pessimista, 2),
            })

            # Move to next month
            if current_month.month == 12:
                current_month = date(current_month.year + 1, 1, 1)
            else:
                current_month = date(current_month.year, current_month.month + 1, 1)

        return {
            "periods": periods,
            "metodo_projecao": "Média móvel dos últimos 6 meses",
            "base_historico_meses": 6,
        }

    def _get_charts_config(self) -> list[dict]:
        """Get chart configurations for Projection report."""
        return [
            {
                "type": "line",
                "title": "Projeção de Fluxo de Caixa",
                "data_key": "periodo",
                "series": [
                    {"key": "cenario_otimista", "label": "Otimista", "color": "#4caf50"},
                    {"key": "cenario_realista", "label": "Realista", "color": "#00bcd4"},
                    {"key": "cenario_pessimista", "label": "Pessimista", "color": "#f44336"},
                ],
            }
        ]

    def _get_summary(self, filters: dict, data: dict) -> dict:
        """Generate summary for Projection report."""
        return {
            "projection_method": data["metodo_projecao"],
            "historical_months": data["base_historico_meses"],
            "projected_months": len(data["periods"]),
        }

    def _count_records(self, data: dict) -> int:
        """Count total records in Projection report."""
        return len(data.get("periods", []))
