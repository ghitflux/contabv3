"""CSV Report Exporter."""

import csv
import io
from datetime import datetime
from pathlib import Path
from typing import Any

from app.services.report.exporters.base import BaseExporter


class CSVExporter(BaseExporter):
    """CSV exporter for reports."""

    async def export(self, data: dict[str, Any], filename: str) -> tuple[bytes, Path]:
        """
        Export report data to CSV.

        Args:
            data: Report data dictionary
            filename: Output filename

        Returns:
            Tuple of (csv_bytes, file_path)
        """
        text_buffer = io.StringIO()
        writer = csv.writer(
            text_buffer, delimiter=";", quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n"
        )

        writer.writerow(["RELATÓRIO", data.get("title", "Relatório")])
        if "period" in data:
            writer.writerow(["PERÍODO", data["period"]])
        if "report_type" in data:
            writer.writerow(["TIPO", str(data["report_type"]).replace("_", " ").title()])
        writer.writerow(
            [
                "GERADO EM",
                datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            ]
        )
        writer.writerow([])

        filters = data.get("filters")
        if isinstance(filters, dict) and filters:
            writer.writerow(["FILTROS APLICADOS"])
            for key, value in filters.items():
                writer.writerow([self._format_key(str(key)), self._format_value(value, str(key))])
            writer.writerow([])

        if "summary" in data and isinstance(data["summary"], dict):
            writer.writerow(["RESUMO"])
            for key, value in data["summary"].items():
                formatted_key = self._format_key(key)
                formatted_value = self._format_value(value, key)
                writer.writerow([formatted_key, formatted_value])
            writer.writerow([])

        if "table_data" in data:
            for row in data["table_data"]:
                writer.writerow(row)

        if "additional_sections" in data:
            for section_name, section_data in data["additional_sections"].items():
                writer.writerow([])
                writer.writerow([section_name.upper()])
                for row in section_data:
                    writer.writerow(row)

        csv_bytes = ("\ufeff" + text_buffer.getvalue()).encode("utf-8")

        file_path = self._save_to_file(csv_bytes, filename)

        return csv_bytes, file_path

    def _format_key(self, key: str) -> str:
        """Format dictionary key for display."""
        key_map = {
            "total_revenue": "Receita Total",
            "total_expenses": "Despesa Total",
            "net_result": "Resultado Líquido",
            "profit_margin": "Margem de Lucro (%)",
            "compliance_rate": "Taxa de Compliance (%)",
            "total_clients": "Total de Clientes",
            "receita_total": "Receita Total",
            "despesa_total": "Despesa Total",
            "resultado_liquido": "Resultado Líquido",
            "margem_lucro": "Margem de Lucro (%)",
            "percentual_despesas_fixas": "Despesas Fixas (%)",
            "taxa_inadimplencia": "Taxa de Inadimplência (%)",
            "ticket_medio": "Ticket Médio",
            "crescimento_mom": "Crescimento MoM (%)",
            "crescimento_yoy": "Crescimento YoY (%)",
            "roi": "ROI (%)",
            "total_receber": "Total a Receber",
            "total_pendente": "Total Pendente",
            "total_atrasado": "Total Atrasado",
            "total_honorarios": "Total Honorários",
            "total_entradas": "Total de Entradas",
            "total_saidas": "Total de Saídas",
            "saldo_inicial": "Saldo Inicial",
            "saldo_final": "Saldo Final",
            "saldo_final_periodo": "Saldo Final do Período",
            "total_lancamentos": "Total de Lançamentos",
            "total_clientes": "Total de Clientes",
            "total_transacoes": "Total de Transações",
            "total_transacoes_atrasadas": "Transações Atrasadas",
        }
        return key_map.get(key, key.replace("_", " ").title())

    def _format_value(self, value: Any, key: str | None = None) -> str:
        """Format value for CSV display."""
        if value is None:
            return "-"
        if isinstance(value, bool):
            return "Sim" if value else "Não"
        if isinstance(value, int):
            return str(value)
        if isinstance(value, float):
            formatted_number = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            normalized_key = (key or "").lower()
            if any(token in normalized_key for token in ["margem", "percent", "percentual", "taxa"]):
                return f"{formatted_number}%"
            if any(
                token in normalized_key
                for token in ["valor", "total", "saldo", "receita", "despesa", "entrada", "saida"]
            ):
                return f"R$ {formatted_number}"
            return formatted_number
        if isinstance(value, str):
            return str(value)
        return str(value)

    def _save_to_file(self, csv_bytes: bytes, filename: str) -> Path:
        """Save CSV bytes to file."""
        today = datetime.now().strftime("%Y%m%d")
        subdir = self._ensure_directory(today)

        lower = filename.lower()
        if not (lower.endswith(".csv") or lower.endswith(".xls")):
            filename += ".csv"

        file_path = subdir / filename
        file_path.write_bytes(csv_bytes)

        return file_path
