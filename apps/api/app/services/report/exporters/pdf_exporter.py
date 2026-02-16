"""PDF Report Exporter using ReportLab."""

import io
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.report.exporters.base import BaseExporter


class PDFExporter(BaseExporter):
    """PDF exporter for reports using ReportLab."""

    async def export(self, data: dict[str, Any], filename: str) -> tuple[bytes, Path]:
        """
        Export report data to PDF.

        Args:
            data: Report data dictionary
            filename: Output filename

        Returns:
            Tuple of (pdf_bytes, file_path)
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=1.5 * cm,
            rightMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.8 * cm,
        )

        styles = self._build_styles()
        story: list[Any] = []

        self._append_header(story, data, styles)
        self._append_key_value_section(story, "Filtros Aplicados", data.get("filters") or {}, styles)
        self._append_key_value_section(story, "Resumo", data.get("summary") or {}, styles)
        self._append_table(story, data.get("table_data") or [], doc.width, styles)

        doc.build(story, onFirstPage=self._draw_footer, onLaterPages=self._draw_footer)

        buffer.seek(0)
        pdf_bytes = buffer.read()

        file_path = self._save_to_file(pdf_bytes, filename)
        return pdf_bytes, file_path

    def _build_styles(self) -> dict[str, ParagraphStyle]:
        base = getSampleStyleSheet()
        return {
            "brand": ParagraphStyle(
                "brand",
                parent=base["Heading2"],
                fontName="Helvetica-Bold",
                fontSize=14,
                textColor=colors.HexColor("#0f172a"),
                spaceAfter=2,
            ),
            "subtitle": ParagraphStyle(
                "subtitle",
                parent=base["BodyText"],
                fontName="Helvetica",
                fontSize=9,
                textColor=colors.HexColor("#64748b"),
                spaceAfter=12,
            ),
            "title": ParagraphStyle(
                "title",
                parent=base["Heading1"],
                fontName="Helvetica-Bold",
                fontSize=16,
                textColor=colors.HexColor("#111827"),
                spaceAfter=6,
            ),
            "meta": ParagraphStyle(
                "meta",
                parent=base["BodyText"],
                fontName="Helvetica",
                fontSize=9,
                textColor=colors.HexColor("#334155"),
                spaceAfter=2,
            ),
            "section": ParagraphStyle(
                "section",
                parent=base["Heading3"],
                fontName="Helvetica-Bold",
                fontSize=11,
                textColor=colors.HexColor("#1e293b"),
                spaceBefore=8,
                spaceAfter=6,
            ),
            "table_header": ParagraphStyle(
                "table_header",
                parent=base["BodyText"],
                fontName="Helvetica-Bold",
                fontSize=8.5,
                textColor=colors.white,
                alignment=1,
            ),
            "table_cell": ParagraphStyle(
                "table_cell",
                parent=base["BodyText"],
                fontName="Helvetica",
                fontSize=8,
                textColor=colors.HexColor("#0f172a"),
            ),
            "kv_key": ParagraphStyle(
                "kv_key",
                parent=base["BodyText"],
                fontName="Helvetica-Bold",
                fontSize=9,
                textColor=colors.HexColor("#1e293b"),
            ),
            "kv_value": ParagraphStyle(
                "kv_value",
                parent=base["BodyText"],
                fontName="Helvetica",
                fontSize=9,
                textColor=colors.HexColor("#334155"),
            ),
        }

    def _append_header(
        self, story: list[Any], data: dict[str, Any], styles: dict[str, ParagraphStyle]
    ) -> None:
        title = data.get("title", "Relatório")
        period = data.get("period")
        generated_at = datetime.now().strftime("%d/%m/%Y %H:%M")

        story.append(Paragraph("CONTABILCONSULT", styles["brand"]))
        story.append(Paragraph("Sistema de Gestão Contábil", styles["subtitle"]))
        story.append(Paragraph(self._escape(str(title)), styles["title"]))

        if period:
            story.append(Paragraph(f"<b>Período:</b> {self._escape(str(period))}", styles["meta"]))
        story.append(Paragraph(f"<b>Gerado em:</b> {generated_at}", styles["meta"]))
        story.append(Spacer(1, 0.35 * cm))

    def _append_key_value_section(
        self,
        story: list[Any],
        section_title: str,
        data: dict[str, Any],
        styles: dict[str, ParagraphStyle],
    ) -> None:
        if not data:
            return

        story.append(Paragraph(section_title, styles["section"]))
        rows = []
        for key, value in data.items():
            rows.append([
                Paragraph(self._escape(self._format_key(str(key))), styles["kv_key"]),
                Paragraph(self._escape(self._format_value(value)), styles["kv_value"]),
            ])

        table = Table(rows, colWidths=[4.5 * cm, 11.0 * cm], hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 0.3 * cm))

    def _append_table(
        self,
        story: list[Any],
        table_data: list[list[str]],
        available_width: float,
        styles: dict[str, ParagraphStyle],
    ) -> None:
        if not table_data:
            return

        story.append(Paragraph("Detalhamento", styles["section"]))
        headers = [str(cell) for cell in table_data[0]]
        col_widths = self._calculate_column_widths(headers, available_width)
        formatted_rows = []

        for row_index, row in enumerate(table_data):
            row_style = styles["table_header"] if row_index == 0 else styles["table_cell"]
            formatted_rows.append(
                [Paragraph(self._escape(str(cell)), row_style) for cell in row]
            )

        table = Table(formatted_rows, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        style_commands: list[tuple[Any, ...]] = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]

        for row_index in range(1, len(formatted_rows)):
            if row_index % 2 == 0:
                style_commands.append(
                    ("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#f8fafc"))
                )

        table.setStyle(TableStyle(style_commands))
        story.append(table)

    def _calculate_column_widths(self, headers: list[str], available_width: float) -> list[float]:
        if not headers:
            return []

        weights: list[float] = []
        for header in headers:
            key = header.lower()
            if "descri" in key:
                weights.append(2.6)
            elif "cliente" in key:
                weights.append(1.8)
            elif "cnpj" in key:
                weights.append(1.3)
            elif "categoria" in key:
                weights.append(1.4)
            elif "método" in key or "metodo" in key:
                weights.append(1.4)
            elif "status" in key:
                weights.append(1.2)
            elif "valor" in key or "saldo" in key:
                weights.append(1.4)
            else:
                weights.append(1.0)

        total_weight = sum(weights) or len(headers)
        return [(available_width * weight) / total_weight for weight in weights]

    def _draw_footer(self, pdf: canvas.Canvas, doc: SimpleDocTemplate) -> None:
        pdf.saveState()
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(colors.HexColor("#64748b"))

        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")
        left = f"ContabilConsult • Gerado em {timestamp}"
        right = f"Página {doc.page}"

        pdf.drawString(doc.leftMargin, 1.1 * cm, left)
        right_width = pdf.stringWidth(right, "Helvetica", 8)
        pdf.drawString(A4[0] - doc.rightMargin - right_width, 1.1 * cm, right)
        pdf.restoreState()

    def _format_key(self, key: str) -> str:
        """Format dictionary key for display."""
        key_map = {
            "total_revenue": "Receita Total",
            "total_expenses": "Despesa Total",
            "net_result": "Resultado Líquido",
            "profit_margin": "Margem de Lucro (%)",
            "compliance_rate": "Taxa de Compliance (%)",
            "total_entradas": "Total de Entradas",
            "total_saidas": "Total de Saídas",
            "saldo_inicial": "Saldo Inicial",
            "saldo_final": "Saldo Final",
            "saldo_final_periodo": "Saldo Final do Período",
            "total_lancamentos": "Total de Lançamentos",
            "total_periodos": "Total de Períodos",
            "total_clients": "Total de Clientes",
        }
        return key_map.get(key, key.replace("_", " ").title())

    def _format_value(self, value: Any) -> str:
        """Format value for display."""
        if isinstance(value, bool):
            return "Sim" if value else "Não"
        if isinstance(value, float):
            formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            return formatted
        if isinstance(value, int):
            return str(value)
        if isinstance(value, str):
            return value
        return str(value)

    def _escape(self, text: str) -> str:
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    def _save_to_file(self, pdf_bytes: bytes, filename: str) -> Path:
        """Save PDF bytes to file."""
        today = datetime.now().strftime("%Y%m%d")
        subdir = self._ensure_directory(today)

        if not filename.endswith(".pdf"):
            filename += ".pdf"

        file_path = subdir / filename
        file_path.write_bytes(pdf_bytes)

        return file_path
