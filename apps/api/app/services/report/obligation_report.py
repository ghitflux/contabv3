"""Obligation Report Service."""

from sqlalchemy import and_, func, select

from app.db.models.client import Client
from app.db.models.obligation import Obligation
from app.db.models.obligation_type import ObligationType
from app.services.report.base import BaseReportService


class ObligationReportService(BaseReportService):
    """Service for generating Obligation reports."""

    async def generate_data(self, filters: dict) -> dict:
        """
        Generate Obligation report data.

        Filters:
            period_start: Start date
            period_end: End date
            client_ids: Optional list of client IDs to filter

        Returns:
            Dictionary with obligation statistics
        """
        client_ids = filters.get("client_ids")
        period_start = filters.get("period_start")
        period_end = filters.get("period_end")
        status_filter = filters.get("status") or filters.get("statuses")

        # Build conditions
        conditions = [Obligation.deleted_at.is_(None)]

        if client_ids:
            conditions.append(Obligation.client_id.in_(client_ids))
        if period_start:
            conditions.append(Obligation.due_date >= period_start)
        if period_end:
            conditions.append(Obligation.due_date <= period_end)
        if status_filter:
            statuses = status_filter if isinstance(status_filter, list) else [status_filter]
            conditions.append(Obligation.status.in_(statuses))

        # Get counts by status
        count_stmt = select(
            func.count().label("total"),
            func.count().filter(Obligation.status == "pendente").label("pending"),
            func.count().filter(Obligation.status == "concluida").label("completed"),
            func.count().filter(Obligation.status == "atrasada").label("overdue"),
            func.count().filter(Obligation.status == "cancelada").label("cancelled"),
        )

        count_stmt = count_stmt.where(and_(*conditions))

        result = await self.db.execute(count_stmt)
        row = result.one()

        # Calculate compliance rate
        total = row.total or 0
        completed = row.completed or 0
        compliance_rate = (completed / total * 100) if total > 0 else 0.0

        obligations_stmt = (
            select(Obligation, Client, ObligationType)
            .join(Client, Obligation.client_id == Client.id)
            .join(ObligationType, Obligation.obligation_type_id == ObligationType.id)
            .where(and_(*conditions))
            .order_by(Obligation.due_date, Client.razao_social, ObligationType.name)
        )
        obligations_result = await self.db.execute(obligations_stmt)
        obligations = [
            {
                "id": str(obligation.id),
                "client_id": str(client.id),
                "client_name": client.nome_fantasia or client.razao_social,
                "client_razao_social": client.razao_social,
                "client_cnpj": client.cnpj,
                "obligation_name": obligation_type.name,
                "obligation_code": obligation_type.code,
                "status": self._enum_value(obligation.status),
                "competencia": obligation.due_date.strftime("%Y-%m"),
                "due_date": obligation.due_date.isoformat(),
                "priority": self._enum_value(obligation.priority),
                "completed_at": obligation.completed_at.isoformat() if obligation.completed_at else None,
            }
            for obligation, client, obligation_type in obligations_result.all()
        ]
        totais_por_status = [
            {"status": "pendente", "total": row.pending or 0},
            {"status": "concluida", "total": completed},
            {"status": "atrasada", "total": row.overdue or 0},
            {"status": "cancelada", "total": row.cancelled or 0},
        ]

        return {
            "compliance_rate": round(compliance_rate, 2),
            "total_obligations": total,
            "pending": row.pending or 0,
            "completed": completed,
            "overdue": row.overdue or 0,
            "cancelled": row.cancelled or 0,
            "totais_por_status": totais_por_status,
            "obligations": obligations,
        }

    def _get_charts_config(self) -> list[dict]:
        """Get chart configurations for Obligation report."""
        return [
            {
                "type": "pie",
                "title": "Obrigações por Status",
                "data_key": "totais_por_status",
                "label_key": "status",
            },
            {
                "type": "table",
                "title": "Obrigações por Cliente",
                "data_key": "obligations",
            },
        ]

    def _get_summary(self, filters: dict, data: dict) -> dict:
        """Generate summary for Obligation report."""
        return {
            "compliance_rate": data["compliance_rate"],
            "total": data["total_obligations"],
            "success_rate": round(
                (data["completed"] / data["total_obligations"] * 100)
                if data["total_obligations"] > 0
                else 0,
                2,
            ),
        }

    def _count_records(self, data: dict) -> int:
        """Count total records in Obligation report."""
        return len(data.get("obligations", []))

    @staticmethod
    def _enum_value(value) -> str:
        return value.value if hasattr(value, "value") else str(value)
