"""Client Report Service."""

from decimal import Decimal

from sqlalchemy import and_, func, select

from app.db.models.client import Client, ClientStatus
from app.db.models.finance import FinancialTransaction, PaymentStatus
from app.services.report.base import BaseReportService


class ClientReportService(BaseReportService):
    """Service for generating Client reports."""

    async def generate_data(self, filters: dict) -> dict:
        """
        Generate Client report data.

        Filters:
            period_start: Start date (optional)
            period_end: End date (optional)
            client_ids: Optional list of client IDs to filter

        Returns:
            Dictionary with client data structure
        """
        client_ids = filters.get("client_ids")

        # Build base conditions
        conditions = [Client.deleted_at.is_(None)]

        if client_ids:
            conditions.append(Client.id.in_(client_ids))

        # Get all clients with their financial summary
        stmt = select(Client).where(and_(*conditions)).order_by(Client.razao_social)

        result = await self.db.execute(stmt)
        clients_list = result.scalars().all()

        clients_data = []
        total_honorarios = Decimal("0.00")
        total_clientes_ativos = 0
        por_regime_map: dict[str, int] = {}
        por_status_map: dict[str, int] = {}

        for client in clients_list:
            # Get pending transactions
            pending_stmt = (
                select(func.sum(FinancialTransaction.amount))
                .where(
                    and_(
                        FinancialTransaction.client_id == client.id,
                        FinancialTransaction.payment_status == PaymentStatus.PENDENTE,
                        FinancialTransaction.deleted_at.is_(None),
                    )
                )
            )
            total_pendente = await self.db.scalar(pending_stmt) or Decimal("0.00")

            # Get overdue transactions
            overdue_stmt = (
                select(func.sum(FinancialTransaction.amount))
                .where(
                    and_(
                        FinancialTransaction.client_id == client.id,
                        FinancialTransaction.payment_status == PaymentStatus.ATRASADO,
                        FinancialTransaction.deleted_at.is_(None),
                    )
                )
            )
            total_atrasado = await self.db.scalar(overdue_stmt) or Decimal("0.00")

            status = self._enum_value(client.status)
            regime = self._enum_value(client.regime_tributario)
            if status == ClientStatus.ATIVO.value:
                total_clientes_ativos += 1
            por_regime_map[regime] = por_regime_map.get(regime, 0) + 1
            por_status_map[status] = por_status_map.get(status, 0) + 1

            clients_data.append({
                "id": str(client.id),
                "razao_social": client.razao_social,
                "nome_fantasia": client.nome_fantasia,
                "cnpj": client.cnpj,
                "email": client.email,
                "status": status,
                "regime_tributario": regime,
                "honorarios": float(client.honorarios_mensais),
                "total_pendente": float(total_pendente),
                "total_atrasado": float(total_atrasado),
            })

            total_honorarios += Decimal(str(client.honorarios_mensais))

        return {
            "clients": clients_data,
            "total_clientes": len(clients_data),
            "total_clientes_ativos": total_clientes_ativos,
            "total_honorarios": float(total_honorarios),
            "por_regime": [
                {"regime": regime, "total": total}
                for regime, total in sorted(por_regime_map.items())
            ],
            "por_status": [
                {"status": status, "total": total}
                for status, total in sorted(por_status_map.items())
            ],
        }

    def _get_charts_config(self) -> list[dict]:
        """Get chart configurations for Client report."""
        return [
            {
                "type": "table",
                "title": "Lista de Clientes",
                "columns": [
                    "razao_social",
                    "status",
                    "regime_tributario",
                    "honorarios",
                    "total_pendente",
                ],
            },
            {
                "type": "pie",
                "title": "Clientes por Status",
                "data_key": "por_status",
            },
            {
                "type": "bar",
                "title": "Clientes por Regime Tributário",
                "data_key": "por_regime",
            }
        ]

    def _get_summary(self, filters: dict, data: dict) -> dict:
        """Generate summary for Client report."""
        return {
            "total_clients": data["total_clientes"],
            "total_active_clients": data["total_clientes_ativos"],
            "total_monthly_fees": data["total_honorarios"],
        }

    def _count_records(self, data: dict) -> int:
        """Count total records in Client report."""
        return len(data.get("clients", []))

    @staticmethod
    def _enum_value(value) -> str:
        return value.value if hasattr(value, "value") else str(value)
