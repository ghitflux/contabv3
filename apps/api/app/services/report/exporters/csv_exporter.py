"""CSV Report Exporter."""

import csv
import io
from datetime import datetime
from pathlib import Path
from typing import Any


class CSVExporter:
    """CSV exporter for reports."""

    def __init__(self):
        self.output_dir = Path("uploads/reports")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def export(self, data: dict[str, Any], filename: str) -> tuple[bytes, Path]:
        """
        Export report data to CSV.

        Args:
            data: Report data dictionary
            filename: Output filename

        Returns:
            Tuple of (csv_bytes, file_path)
        """
        # Generate CSV in memory with UTF-8 BOM for Excel compatibility
        text_buffer = io.StringIO()
        writer = csv.writer(
            text_buffer, delimiter=";", quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n"
        )

        # Write header/metadata
        writer.writerow(["RELATÓRIO", data.get("title", "Relatório")])
        if "period" in data:
            writer.writerow(["PERÍODO", data["period"]])
        writer.writerow(
            [
                "GERADO EM",
                datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
            ]
        )
        writer.writerow([])  # Blank row

        # Write summary if exists
        if "summary" in data:
            writer.writerow(["RESUMO"])
            for key, value in data["summary"].items():
                formatted_key = self._format_key(key)
                formatted_value = self._format_value(value)
                writer.writerow([formatted_key, formatted_value])
            writer.writerow([])  # Blank row

        # Write main data table
        if "table_data" in data:
            for row in data["table_data"]:
                writer.writerow(row)

        # Write additional sections if exists
        if "additional_sections" in data:
            for section_name, section_data in data["additional_sections"].items():
                writer.writerow([])  # Blank row
                writer.writerow([section_name.upper()])
                for row in section_data:
                    writer.writerow(row)

        # Get CSV bytes (prepend BOM)
        csv_bytes = ("\ufeff" + text_buffer.getvalue()).encode("utf-8")

        # Save to file
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
            "total_honorarios": "Total Honorários",
        }
        return key_map.get(key, key.replace("_", " ").title())

    def _format_value(self, value: Any) -> str:
        """Format value for CSV display."""
        if isinstance(value, float):
            return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        if isinstance(value, (int, str)):
            return str(value)
        return str(value)

    def _save_to_file(self, csv_bytes: bytes, filename: str) -> Path:
        """Save CSV bytes to file."""
        # Create subdirectory by date
        today = datetime.now().strftime("%Y%m%d")
        subdir = self._ensure_directory(today)

        # Ensure a valid extension (.csv or .xls)
        lower = filename.lower()
        if not (lower.endswith(".csv") or lower.endswith(".xls")):
            filename += ".csv"

        file_path = subdir / filename
        file_path.write_bytes(csv_bytes)

        return file_path

    def _ensure_directory(self, subdirectory: str) -> Path:
        """Ensure a subdirectory exists."""
        dir_path = self.output_dir / subdirectory
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path
