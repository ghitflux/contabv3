"""Cash Book Report Service - Livro Caixa."""

from datetime import datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import and_, select

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, TransactionType
from app.services.report.base import BaseReportService


class CashBookReportService(BaseReportService):
    """Service for generating Cash Book reports."""

    async def generate_data(self, filters: dict) -> dict:
        """
        Generate Cash Book report data with chronological entries.

        Filters:
            period_start: Start date
            period_end: End date
            client_ids: Optional list of client IDs to filter

        Returns:
            Dictionary with cash book entries
        """
        period_start = filters["period_start"]
        period_end = filters["period_end"]
        client_ids = filters.get("client_ids")
        period_start_at = datetime.combine(period_start, time.min)
        period_end_exclusive = datetime.combine(period_end + timedelta(days=1), time.min)

        # Build conditions
        conditions = [
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.paid_date.isnot(None),  # Only paid transactions
        ]

        if client_ids:
            conditions.append(FinancialTransaction.client_id.in_(client_ids))

        # Get all transactions ordered by paid date
        stmt = (
            select(
                FinancialTransaction,
                Client.razao_social,
                Client.nome_fantasia,
                Client.cnpj,
            )
            .join(Client, FinancialTransaction.client_id == Client.id)
            .where(and_(*conditions))
            .filter(
                FinancialTransaction.paid_date >= period_start_at,
                FinancialTransaction.paid_date < period_end_exclusive,
            )
            .order_by(FinancialTransaction.paid_date, FinancialTransaction.created_at)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        # Build entries with accumulated balance
        entries = []
        saldo_acumulado = Decimal("0.00")
        total_entradas = Decimal("0.00")
        total_saidas = Decimal("0.00")

        for transaction, razao_social, nome_fantasia, cnpj in rows:
            tipo = "entrada" if transaction.transaction_type == TransactionType.RECEITA else "saida"
            valor = transaction.amount
            client_name = nome_fantasia or razao_social or "Sem cliente"
            paid_date = transaction.paid_date.date().isoformat() if transaction.paid_date else None

            if tipo == "entrada":
                saldo_acumulado += valor
                total_entradas += valor
            else:
                saldo_acumulado -= valor
                total_saidas += valor

            entries.append({
                "data": paid_date,
                "tipo": tipo,
                "descricao": transaction.description,
                "cliente": client_name,
                "cnpj": cnpj,
                "categoria": transaction.category or "-",
                "metodo_pagamento": (
                    transaction.payment_method.value if transaction.payment_method else "-"
                ),
                "status_pagamento": (
                    transaction.payment_status.value if transaction.payment_status else "-"
                ),
                "vencimento": transaction.due_date.isoformat() if transaction.due_date else None,
                "referencia": (
                    transaction.reference_month.isoformat()
                    if transaction.reference_month
                    else None
                ),
                "valor": float(valor),
                "saldo_acumulado": float(saldo_acumulado),
            })

        return {
            "entries": entries,
            "saldo_inicial": 0.0,  # Could be enhanced to get opening balance
            "saldo_final": float(saldo_acumulado),
            "total_entradas": float(total_entradas),
            "total_saidas": float(total_saidas),
        }

    def _get_charts_config(self) -> list[dict]:
        """Get chart configurations for Cash Book report."""
        return [
            {
                "type": "table",
                "title": "Livro Caixa",
                "columns": [
                    "data",
                    "tipo",
                    "descricao",
                    "cliente",
                    "cnpj",
                    "categoria",
                    "metodo_pagamento",
                    "status_pagamento",
                    "valor",
                    "saldo_acumulado",
                ],
            }
        ]

    def _get_summary(self, filters: dict, data: dict) -> dict:
        """Generate summary for Cash Book report."""
        return {
            "period": f"{filters['period_start'].isoformat()} a {filters['period_end'].isoformat()}",
            "saldo_inicial": data["saldo_inicial"],
            "total_entradas": data["total_entradas"],
            "total_saidas": data["total_saidas"],
            "saldo_final": data["saldo_final"],
            "total_lancamentos": len(data["entries"]),
        }

    def _count_records(self, data: dict) -> int:
        """Count total records in Cash Book report."""
        return len(data.get("entries", []))
