"""Financial Report Service - Generates financial KPIs and reports."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.repositories.transaction import TransactionRepository


class FinancialReportService:
    """Service for generating financial reports and KPIs."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.transaction_repo = TransactionRepository(db)

    async def get_dashboard_kpis(self) -> dict:
        """
        Get financial KPIs for dashboard.

        Returns:
            Dictionary with KPI data
        """
        # Current month
        today = date.today()
        current_month_start = today.replace(day=1)

        # Previous month
        if current_month_start.month == 1:
            previous_month_start = date(current_month_start.year - 1, 12, 1)
        else:
            previous_month_start = date(current_month_start.year, current_month_start.month - 1, 1)

        # Current month revenue (paid RECEITA transactions only)
        total_receita_mes_atual = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.PAGO,
            reference_month=current_month_start,
            transaction_type=TransactionType.RECEITA,
        )

        # Previous month revenue (paid RECEITA transactions only)
        total_receita_mes_anterior = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.PAGO,
            reference_month=previous_month_start,
            transaction_type=TransactionType.RECEITA,
        )

        # Calculate growth percentage
        if total_receita_mes_anterior > 0:
            receita_crescimento_percentual = (
                float((total_receita_mes_atual - total_receita_mes_anterior) / total_receita_mes_anterior * 100)
            )
        else:
            receita_crescimento_percentual = 0.0

        # Pending transactions
        total_pendente = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.PENDENTE,
        )

        # Overdue transactions
        total_atrasado = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.ATRASADO,
        )

        # Count transactions
        count_pendente = await self._count_by_status(PaymentStatus.PENDENTE)
        count_atrasado = await self._count_by_status(PaymentStatus.ATRASADO)
        count_pago_mes_atual = await self._count_by_status(
            PaymentStatus.PAGO,
            reference_month=current_month_start
        )

        # Top clients with outstanding balance
        top_devedores = await self.transaction_repo.get_top_clients_by_outstanding(limit=5)

        return {
            "total_receita_mes_atual": float(total_receita_mes_atual),
            "total_receita_mes_anterior": float(total_receita_mes_anterior),
            "receita_crescimento_percentual": receita_crescimento_percentual,
            "total_pendente": float(total_pendente),
            "total_atrasado": float(total_atrasado),
            "total_pago_mes_atual": float(total_receita_mes_atual),  # total RECEITA paga no mês atual (coincide com total_receita_mes_atual pois ambos filtram PAGO+RECEITA+mês)
            "count_pendente": count_pendente,
            "count_atrasado": count_atrasado,
            "count_pago_mes_atual": count_pago_mes_atual,
            "top_devedores": [
                {
                    "client_id": str(client_id),
                    "client_name": client_name,
                    "total_pendente": float(total),
                }
                for client_id, client_name, total in top_devedores
            ],
        }

    async def get_receivables_aging_report(self) -> dict:
        """
        Get receivables aging report.

        Categorizes outstanding receivables by age:
        - Current (not due yet)
        - 0-30 days overdue
        - 31-60 days overdue
        - 61-90 days overdue
        - Over 90 days overdue

        Returns:
            Dictionary with aging buckets
        """
        today = date.today()

        # Get all pending and overdue transactions
        stmt = (
            select(FinancialTransaction)
            .where(
                and_(
                    FinancialTransaction.payment_status.in_([
                        PaymentStatus.PENDENTE,
                        PaymentStatus.ATRASADO,
                    ]),
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        transactions = result.scalars().all()

        # Initialize buckets
        buckets = {
            "current": {"label": "Não vencido", "count": 0, "total_amount": Decimal("0.00")},
            "days_0_30": {"label": "0-30 dias", "count": 0, "total_amount": Decimal("0.00")},
            "days_31_60": {"label": "31-60 dias", "count": 0, "total_amount": Decimal("0.00")},
            "days_61_90": {"label": "61-90 dias", "count": 0, "total_amount": Decimal("0.00")},
            "days_over_90": {"label": "Mais de 90 dias", "count": 0, "total_amount": Decimal("0.00")},
        }

        # Categorize transactions
        for transaction in transactions:
            days_overdue = (today - transaction.due_date).days

            if days_overdue < 0:
                bucket = buckets["current"]
            elif days_overdue <= 30:
                bucket = buckets["days_0_30"]
            elif days_overdue <= 60:
                bucket = buckets["days_31_60"]
            elif days_overdue <= 90:
                bucket = buckets["days_61_90"]
            else:
                bucket = buckets["days_over_90"]

            bucket["count"] += 1
            bucket["total_amount"] += transaction.amount

        # Calculate totals
        total = sum(bucket["total_amount"] for bucket in buckets.values())
        total_count = sum(bucket["count"] for bucket in buckets.values())

        return {
            "current": {
                "label": buckets["current"]["label"],
                "count": buckets["current"]["count"],
                "total_amount": float(buckets["current"]["total_amount"]),
            },
            "days_0_30": {
                "label": buckets["days_0_30"]["label"],
                "count": buckets["days_0_30"]["count"],
                "total_amount": float(buckets["days_0_30"]["total_amount"]),
            },
            "days_31_60": {
                "label": buckets["days_31_60"]["label"],
                "count": buckets["days_31_60"]["count"],
                "total_amount": float(buckets["days_31_60"]["total_amount"]),
            },
            "days_61_90": {
                "label": buckets["days_61_90"]["label"],
                "count": buckets["days_61_90"]["count"],
                "total_amount": float(buckets["days_61_90"]["total_amount"]),
            },
            "days_over_90": {
                "label": buckets["days_over_90"]["label"],
                "count": buckets["days_over_90"]["count"],
                "total_amount": float(buckets["days_over_90"]["total_amount"]),
            },
            "total": float(total),
            "total_count": total_count,
        }

    async def get_revenue_by_period(
        self,
        start_month: date,
        end_month: date,
    ) -> dict:
        """
        Get revenue by period (monthly).

        Args:
            start_month: Start month (first day)
            end_month: End month (first day)

        Returns:
            Dictionary with revenue data by period
        """
        # Ensure dates are first day of month
        start_month = start_month.replace(day=1)
        end_month = end_month.replace(day=1)

        # Get revenue data from repository
        revenue_data = await self.transaction_repo.get_revenue_by_period(
            start_month=start_month,
            end_month=end_month,
        )

        # Build periods list
        periods = []
        current_month = start_month

        # Create a dict for quick lookup
        revenue_by_month = {month: amount for month, amount in revenue_data}

        while current_month <= end_month:
            month_str = current_month.strftime("%Y-%m")
            receita = revenue_by_month.get(current_month, Decimal("0.00"))

            periods.append({
                "period": month_str,
                "receita": float(receita),
                "despesa": 0.0,  # Future: add expense tracking
                "saldo": float(receita),
            })

            # Move to next month
            if current_month.month == 12:
                current_month = date(current_month.year + 1, 1, 1)
            else:
                current_month = date(current_month.year, current_month.month + 1, 1)

        # Calculate totals
        total_receita = sum(p["receita"] for p in periods)
        total_despesa = sum(p["despesa"] for p in periods)
        total_saldo = total_receita - total_despesa

        return {
            "periods": periods,
            "total_receita": total_receita,
            "total_despesa": total_despesa,
            "total_saldo": total_saldo,
        }

    async def get_client_financial_summary(
        self,
        client_id: UUID,
    ) -> dict:
        """
        Get financial summary for a specific client.

        Args:
            client_id: Client UUID

        Returns:
            Dictionary with client financial data
        """
        # Get client
        stmt = select(Client).where(Client.id == client_id)
        result = await self.db.execute(stmt)
        client = result.scalar_one_or_none()

        if not client:
            raise ValueError(f"Client with ID {client_id} not found")

        # Get balances
        total_pendente = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.PENDENTE,
            client_id=client_id,
        )

        total_atrasado = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.ATRASADO,
            client_id=client_id,
        )

        total_pago = await self.transaction_repo.get_total_by_status(
            status=PaymentStatus.PAGO,
            client_id=client_id,
        )

        # Get last payment date
        stmt = (
            select(FinancialTransaction.paid_date)
            .where(
                and_(
                    FinancialTransaction.client_id == client_id,
                    FinancialTransaction.payment_status == PaymentStatus.PAGO,
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .order_by(FinancialTransaction.paid_date.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        ultimo_pagamento = result.scalar_one_or_none()

        # Get next due date
        stmt = (
            select(FinancialTransaction.due_date)
            .where(
                and_(
                    FinancialTransaction.client_id == client_id,
                    FinancialTransaction.payment_status.in_([
                        PaymentStatus.PENDENTE,
                        PaymentStatus.ATRASADO,
                    ]),
                    FinancialTransaction.deleted_at.is_(None),
                )
            )
            .order_by(FinancialTransaction.due_date)
            .limit(1)
        )
        result = await self.db.execute(stmt)
        proxima_vencimento = result.scalar_one_or_none()

        # Get recent transactions
        transactions, _ = await self.transaction_repo.list_by_client(
            client_id=client_id,
            skip=0,
            limit=10,
        )

        return {
            "client_id": str(client.id),
            "client_name": client.razao_social,
            "client_cnpj": client.cnpj,
            "total_pendente": float(total_pendente),
            "total_atrasado": float(total_atrasado),
            "total_pago": float(total_pago),
            "ultimo_pagamento": ultimo_pagamento.isoformat() if ultimo_pagamento else None,
            "proxima_vencimento": proxima_vencimento.isoformat() if proxima_vencimento else None,
            "transactions": [
                {
                    "id": str(t.id),
                    "amount": float(t.amount),
                    "payment_status": t.payment_status,
                    "due_date": t.due_date.isoformat(),
                    "paid_date": t.paid_date.isoformat() if t.paid_date else None,
                    "reference_month": t.reference_month.isoformat(),
                    "description": t.description,
                }
                for t in transactions
            ],
        }

    async def _count_by_status(
        self,
        status: PaymentStatus,
        reference_month: Optional[date] = None,
    ) -> int:
        """Count transactions by status."""
        conditions = [
            FinancialTransaction.payment_status == status,
            FinancialTransaction.deleted_at.is_(None),
        ]

        if reference_month:
            conditions.append(FinancialTransaction.reference_month == reference_month)

        stmt = (
            select(func.count())
            .select_from(FinancialTransaction)
            .where(and_(*conditions))
        )
        result = await self.db.scalar(stmt)
        return result or 0
