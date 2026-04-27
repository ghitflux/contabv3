"""Statement import service for bank statements."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models.bank_account import BankAccount
from app.db.models.finance import (
    FinancialTransaction,
    PaymentStatus,
    StatementImport,
    StatementImportFormat,
    StatementImportRow,
    StatementImportStatus,
    TransactionType,
)
from app.schemas.finance import TransactionCreate
from app.services.finance.transaction_service import TransactionService


SUPPORTED_STATEMENT_EXTENSIONS: dict[str, StatementImportFormat] = {
    ".csv": StatementImportFormat.CSV,
    ".ofx": StatementImportFormat.OFX,
    ".pdf": StatementImportFormat.PDF,
}


@dataclass
class ParsedStatementRow:
    line_number: int
    transaction_date: date
    description: str
    raw_description: str | None
    amount_signed: Decimal
    balance_after: Decimal | None
    transaction_type: TransactionType
    confidence: Decimal


@dataclass
class ParsedStatement:
    source_format: StatementImportFormat
    detected_bank_name: str | None
    detected_account_number: str | None
    period_start: date | None
    period_end: date | None
    opening_balance: Decimal | None
    closing_balance: Decimal | None
    rows: list[ParsedStatementRow]


class StatementImportService:
    """Parse, stage and commit bank statement imports."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.transaction_service = TransactionService(db)

    async def preview_import(
        self,
        *,
        bank_account: BankAccount,
        created_by_id: UUID,
        filename: str,
        content_type: str | None,
        file_bytes: bytes,
    ) -> StatementImport:
        source_format = self._resolve_format(filename, content_type)
        parsed = self._parse_statement(source_format, file_bytes)
        if not parsed.rows:
            raise ValueError("Nenhum lançamento foi identificado no extrato.")

        client_id = self._resolve_target_client_id(bank_account)
        duplicate_reasons = await self._detect_duplicates(client_id=client_id, rows=parsed.rows)

        batch = StatementImport(
            client_id=client_id,
            bank_account_id=bank_account.id,
            created_by_id=created_by_id,
            source_format=parsed.source_format,
            status=StatementImportStatus.PREVIEW,
            original_filename=filename,
            detected_bank_name=parsed.detected_bank_name or bank_account.name,
            detected_account_number=parsed.detected_account_number,
            period_start=parsed.period_start,
            period_end=parsed.period_end,
            opening_balance=parsed.opening_balance,
            closing_balance=parsed.closing_balance,
            total_rows=len(parsed.rows),
            duplicate_rows=sum(1 for reason in duplicate_reasons if reason),
            imported_rows=0,
        )
        self.db.add(batch)
        await self.db.flush()

        for parsed_row, duplicate_reason in zip(parsed.rows, duplicate_reasons, strict=True):
            self.db.add(
                StatementImportRow(
                    statement_import_id=batch.id,
                    line_number=parsed_row.line_number,
                    transaction_date=parsed_row.transaction_date,
                    description=parsed_row.description,
                    raw_description=parsed_row.raw_description,
                    amount_signed=self._quantize(parsed_row.amount_signed),
                    balance_after=(
                        self._quantize(parsed_row.balance_after)
                        if parsed_row.balance_after is not None
                        else None
                    ),
                    transaction_type=parsed_row.transaction_type,
                    confidence=self._quantize(parsed_row.confidence, places="0.001"),
                    is_selected=duplicate_reason is None,
                    duplicate_suspected=duplicate_reason is not None,
                    duplicate_reason=duplicate_reason,
                )
            )

        await self.db.flush()
        return await self.get_import(batch.id)

    async def get_import(self, import_id: UUID) -> StatementImport:
        stmt = (
            select(StatementImport)
            .where(StatementImport.id == import_id)
            .options(
                selectinload(StatementImport.rows),
                selectinload(StatementImport.bank_account),
            )
        )
        statement_import = await self.db.scalar(stmt)
        if statement_import is None:
            raise ValueError("Importação não encontrada.")
        statement_import.rows.sort(key=lambda row: (row.line_number, row.created_at))
        return statement_import

    async def commit_import(
        self,
        *,
        import_id: UUID,
        rows_payload: dict[UUID, tuple[bool, str | None, str | None]],
        committed_by_id: UUID,
    ) -> tuple[StatementImport, list[FinancialTransaction], int, int]:
        statement_import = await self.get_import(import_id)
        if statement_import.status not in {
            StatementImportStatus.PREVIEW,
            StatementImportStatus.COMMITTED,
        }:
            raise ValueError("Importação não pode ser confirmada.")

        skipped_count = 0
        duplicate_skipped_count = 0
        imported_transactions: list[FinancialTransaction] = []

        for row in statement_import.rows:
            payload = rows_payload.get(row.id)
            if payload is not None:
                is_selected, category, notes = payload
                row.is_selected = is_selected
                row.category = category.strip() if category else None
                row.notes = notes.strip() if notes else None

            if row.committed_transaction_id:
                continue

            if not row.is_selected:
                skipped_count += 1
                if row.duplicate_suspected:
                    duplicate_skipped_count += 1
                continue

            if not row.category:
                raise ValueError(
                    f"Informe a categoria para a linha {row.line_number} antes de importar."
                )

            tx = await self.transaction_service.create_transaction(
                TransactionCreate(
                    client_id=statement_import.client_id,
                    bank_account_id=statement_import.bank_account_id,
                    transaction_type=row.transaction_type,
                    amount=abs(row.amount_signed),
                    payment_status=PaymentStatus.PAGO,
                    due_date=row.transaction_date,
                    paid_date=datetime.combine(row.transaction_date, time(hour=12)),
                    reference_month=row.transaction_date.replace(day=1),
                    description=row.description,
                    category=row.category,
                    notes=self._compose_transaction_notes(row, statement_import),
                ),
                created_by_id=committed_by_id,
            )
            row.committed_transaction_id = tx.id
            row.committed_at = datetime.utcnow()
            imported_transactions.append(tx)

        statement_import.imported_rows = sum(
            1 for row in statement_import.rows if row.committed_transaction_id is not None
        )
        statement_import.duplicate_rows = sum(
            1 for row in statement_import.rows if row.duplicate_suspected
        )
        statement_import.status = StatementImportStatus.COMMITTED
        statement_import.committed_at = datetime.utcnow()
        await self.db.flush()

        return statement_import, imported_transactions, skipped_count, duplicate_skipped_count

    def _resolve_format(
        self,
        filename: str,
        content_type: str | None,
    ) -> StatementImportFormat:
        ext = Path(filename).suffix.lower()
        if ext in SUPPORTED_STATEMENT_EXTENSIONS:
            return SUPPORTED_STATEMENT_EXTENSIONS[ext]
        if content_type:
            normalized = content_type.lower()
            if "pdf" in normalized:
                return StatementImportFormat.PDF
            if "ofx" in normalized:
                return StatementImportFormat.OFX
            if "csv" in normalized or "comma-separated-values" in normalized:
                return StatementImportFormat.CSV
        raise ValueError("Formato não suportado. Use PDF, OFX ou CSV.")

    def _parse_statement(
        self,
        source_format: StatementImportFormat,
        file_bytes: bytes,
    ) -> ParsedStatement:
        if source_format == StatementImportFormat.CSV:
            return self._parse_csv_statement(file_bytes)
        if source_format == StatementImportFormat.OFX:
            return self._parse_ofx_statement(file_bytes)
        if source_format == StatementImportFormat.PDF:
            return self._parse_pdf_statement(file_bytes)
        raise ValueError("Formato de extrato não suportado.")

    def _parse_csv_statement(self, file_bytes: bytes) -> ParsedStatement:
        text = self._decode_text(file_bytes)
        lines = [line.strip("\ufeff") for line in text.splitlines() if line.strip()]
        if not lines:
            raise ValueError("CSV vazio.")

        sample = "\n".join(lines[:10])
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,|\t")
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = ";"

        header_index = None
        metadata_lines: list[str] = []
        for idx, line in enumerate(lines):
            columns = [self._normalize_header_token(part) for part in line.split(delimiter)]
            if {"data", "valor"}.issubset(set(columns)):
                header_index = idx
                break
            metadata_lines.append(line)

        if header_index is None:
            raise ValueError("Não foi possível localizar o cabeçalho do CSV.")

        header = [self._normalize_header_token(part) for part in lines[header_index].split(delimiter)]
        reader = csv.DictReader(io.StringIO("\n".join(lines[header_index + 1 :])), fieldnames=header, delimiter=delimiter)

        rows: list[ParsedStatementRow] = []
        line_number = 0
        for raw in reader:
            parsed_row = self._parse_delimited_row(raw, line_number + 1)
            if parsed_row is None:
                continue
            rows.append(parsed_row)
            line_number += 1

        if not rows:
            raise ValueError("Nenhum lançamento válido foi encontrado no CSV.")

        account_number = self._extract_metadata_value(metadata_lines, ("conta", "account"))
        period_label = self._extract_metadata_value(metadata_lines, ("periodo", "período"))
        opening_balance = self._extract_decimal_metadata(metadata_lines, ("saldo",))

        period_start, period_end = self._parse_period_value(period_label)
        closing_balance = self._infer_closing_balance(rows)
        if opening_balance is None:
            opening_balance = self._infer_opening_balance(rows)

        return ParsedStatement(
            source_format=StatementImportFormat.CSV,
            detected_bank_name=None,
            detected_account_number=account_number,
            period_start=period_start,
            period_end=period_end,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            rows=rows,
        )

    def _parse_ofx_statement(self, file_bytes: bytes) -> ParsedStatement:
        text = self._decode_text(file_bytes)
        normalized = text.replace("\r", "")

        account_number = self._extract_ofx_tag(normalized, "ACCTID")
        bank_name = self._extract_ofx_tag(normalized, "ORG") or self._extract_ofx_tag(normalized, "BANKID")
        period_start = self._parse_ofx_date(self._extract_ofx_tag(normalized, "DTSTART"))
        period_end = self._parse_ofx_date(self._extract_ofx_tag(normalized, "DTEND"))

        rows: list[ParsedStatementRow] = []
        for line_number, block in enumerate(
            re.findall(r"<STMTTRN>(.*?)</STMTTRN>", normalized, flags=re.IGNORECASE | re.DOTALL),
            start=1,
        ):
            dt_posted = self._parse_ofx_date(self._extract_ofx_tag(block, "DTPOSTED"))
            amount = self._parse_decimal(self._extract_ofx_tag(block, "TRNAMT"))
            if dt_posted is None or amount is None:
                continue
            name = (self._extract_ofx_tag(block, "NAME") or "").strip()
            memo = (self._extract_ofx_tag(block, "MEMO") or "").strip()
            fitid = (self._extract_ofx_tag(block, "FITID") or "").strip()
            raw_description = " | ".join(part for part in [name, memo, fitid] if part)
            description = name or memo or fitid or "Movimento importado"
            rows.append(
                ParsedStatementRow(
                    line_number=line_number,
                    transaction_date=dt_posted,
                    description=description[:500],
                    raw_description=raw_description[:2000] if raw_description else None,
                    amount_signed=amount,
                    balance_after=None,
                    transaction_type=(
                        TransactionType.RECEITA if amount >= 0 else TransactionType.DESPESA
                    ),
                    confidence=Decimal("1.000"),
                )
            )

        if not rows:
            raise ValueError("Nenhum lançamento foi encontrado no OFX.")

        ledger_balance = self._parse_decimal(self._extract_ofx_tag(normalized, "BALAMT"))
        available_balance = self._parse_decimal(self._extract_ofx_tag(normalized, "AVAILBAL"))
        closing_balance = ledger_balance if ledger_balance is not None else available_balance

        return ParsedStatement(
            source_format=StatementImportFormat.OFX,
            detected_bank_name=bank_name,
            detected_account_number=account_number,
            period_start=period_start,
            period_end=period_end,
            opening_balance=None,
            closing_balance=closing_balance,
            rows=rows,
        )

    def _parse_pdf_statement(self, file_bytes: bytes) -> ParsedStatement:
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise ValueError("Suporte a PDF indisponível no ambiente atual.") from exc

        reader = PdfReader(io.BytesIO(file_bytes))
        text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if len(re.sub(r"\s+", "", text)) < 20:
            raise ValueError("PDF sem texto nativo detectável. Use PDF com texto selecionável.")

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        rows: list[ParsedStatementRow] = []

        detected_account_number = None
        detected_bank_name = None
        period_start = None
        period_end = None
        opening_balance = None

        for line in lines:
            normalized = self._normalize_text(line)
            if detected_account_number is None and "conta" in normalized:
                detected_account_number = self._extract_line_account_number(line)
            if period_start is None and ("periodo" in normalized or "período" in line.lower()):
                period_start, period_end = self._parse_period_value(line)
            if opening_balance is None and "saldo" in normalized:
                opening_balance = self._parse_decimal_from_text(line)

        for raw_line in lines:
            parsed = self._parse_pdf_transaction_line(raw_line, len(rows) + 1)
            if parsed is not None:
                rows.append(parsed)

        if not rows:
            raise ValueError("Não foi possível identificar linhas do extrato no PDF.")

        closing_balance = self._infer_closing_balance(rows)
        if opening_balance is None:
            opening_balance = self._infer_opening_balance(rows)

        return ParsedStatement(
            source_format=StatementImportFormat.PDF,
            detected_bank_name=detected_bank_name,
            detected_account_number=detected_account_number,
            period_start=period_start,
            period_end=period_end,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            rows=rows,
        )

    async def _detect_duplicates(
        self,
        *,
        client_id: UUID,
        rows: list[ParsedStatementRow],
    ) -> list[str | None]:
        if not rows:
            return []

        dates = [row.transaction_date for row in rows]
        stmt = (
            select(FinancialTransaction)
            .where(
                and_(
                    FinancialTransaction.client_id == client_id,
                    FinancialTransaction.deleted_at.is_(None),
                    FinancialTransaction.due_date >= min(dates),
                    FinancialTransaction.due_date <= max(dates),
                )
            )
        )
        existing_transactions = list((await self.db.execute(stmt)).scalars().all())
        reasons: list[str | None] = []
        seen_rows: list[ParsedStatementRow] = []

        for row in rows:
            duplicate_reason = self._find_existing_duplicate_reason(row, existing_transactions)
            if duplicate_reason is None:
                duplicate_reason = self._find_batch_duplicate_reason(row, seen_rows)
            reasons.append(duplicate_reason)
            seen_rows.append(row)

        return reasons

    def _find_existing_duplicate_reason(
        self,
        row: ParsedStatementRow,
        existing_transactions: Iterable[FinancialTransaction],
    ) -> str | None:
        target_amount = self._quantize(abs(row.amount_signed))
        normalized_description = self._normalize_description_for_match(row.description)

        for transaction in existing_transactions:
            if transaction.due_date != row.transaction_date:
                continue
            if transaction.transaction_type != row.transaction_type:
                continue
            if self._quantize(transaction.amount) != target_amount:
                continue
            candidate = self._normalize_description_for_match(transaction.description)
            if self._description_similarity(normalized_description, candidate) >= 0.88:
                return "Possível duplicado com lançamento já existente."
        return None

    def _find_batch_duplicate_reason(
        self,
        row: ParsedStatementRow,
        seen_rows: Iterable[ParsedStatementRow],
    ) -> str | None:
        normalized_description = self._normalize_description_for_match(row.description)
        for other in seen_rows:
            if other.transaction_date != row.transaction_date:
                continue
            if other.transaction_type != row.transaction_type:
                continue
            if self._quantize(abs(other.amount_signed)) != self._quantize(abs(row.amount_signed)):
                continue
            if (
                self._description_similarity(
                    normalized_description,
                    self._normalize_description_for_match(other.description),
                )
                >= 0.95
            ):
                return "Possível duplicado dentro do próprio extrato."
        return None

    def _compose_transaction_notes(
        self,
        row: StatementImportRow,
        statement_import: StatementImport,
    ) -> str:
        parts = [
            f"Importação de extrato {statement_import.source_format.value.upper()}",
        ]
        if statement_import.bank_account and statement_import.bank_account.name:
            parts.append(f"Caixa: {statement_import.bank_account.name}")
        if row.raw_description:
            parts.append(f"Histórico bruto: {row.raw_description}")
        if row.balance_after is not None:
            parts.append(f"Saldo após movimento: {self._format_decimal(row.balance_after)}")
        if row.notes:
            parts.append(f"Obs: {row.notes}")
        return " | ".join(parts)

    def _resolve_target_client_id(self, bank_account: BankAccount) -> UUID:
        if bank_account.client_id is not None:
            return bank_account.client_id
        if settings.OFFICE_CLIENT_ID is None:
            raise ValueError("Configure o OFFICE_CLIENT_ID para importar extratos do escritório.")
        return settings.OFFICE_CLIENT_ID

    def _parse_delimited_row(
        self,
        raw: dict[str, str | None],
        line_number: int,
    ) -> ParsedStatementRow | None:
        date_value = self._parse_date(
            raw.get("data")
            or raw.get("datalancamento")
            or raw.get("datamovimento")
        )
        amount = self._parse_decimal(raw.get("valor"))
        if date_value is None or amount is None:
            return None

        history = (
            raw.get("historico")
            or raw.get("historicolancamento")
            or raw.get("historicoevento")
            or ""
        ).strip()
        description = (
            raw.get("descricao")
            or raw.get("descricaolancamento")
            or raw.get("memo")
            or ""
        ).strip()
        best_description = description or history or "Movimento importado"
        raw_description = " | ".join(part for part in [history, description] if part) or None
        balance_after = self._parse_decimal(raw.get("saldo"))

        return ParsedStatementRow(
            line_number=line_number,
            transaction_date=date_value,
            description=best_description[:500],
            raw_description=(raw_description[:2000] if raw_description else None),
            amount_signed=amount,
            balance_after=balance_after,
            transaction_type=TransactionType.RECEITA if amount >= 0 else TransactionType.DESPESA,
            confidence=Decimal("1.000"),
        )

    def _parse_pdf_transaction_line(
        self,
        raw_line: str,
        line_number: int,
    ) -> ParsedStatementRow | None:
        match = re.match(
            r"^\s*(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(-?\d[\d\.\,]*)\s+(-?\d[\d\.\,]*)\s*$",
            raw_line,
        )
        if not match:
            return None

        transaction_date = self._parse_date(match.group(1))
        amount = self._parse_decimal(match.group(3))
        balance_after = self._parse_decimal(match.group(4))
        if transaction_date is None or amount is None:
            return None

        description = re.sub(r"\s+", " ", match.group(2)).strip()
        if not description:
            description = "Movimento importado"

        return ParsedStatementRow(
            line_number=line_number,
            transaction_date=transaction_date,
            description=description[:500],
            raw_description=description[:2000],
            amount_signed=amount,
            balance_after=balance_after,
            transaction_type=TransactionType.RECEITA if amount >= 0 else TransactionType.DESPESA,
            confidence=Decimal("0.780"),
        )

    def _extract_ofx_tag(self, payload: str, tag: str) -> str | None:
        match = re.search(rf"<{tag}>([^<\r\n]+)", payload, flags=re.IGNORECASE)
        return match.group(1).strip() if match else None

    def _parse_ofx_date(self, value: str | None) -> date | None:
        if not value:
            return None
        digits = re.sub(r"[^\d]", "", value)
        if len(digits) < 8:
            return None
        try:
            return datetime.strptime(digits[:8], "%Y%m%d").date()
        except ValueError:
            return None

    def _parse_period_value(self, value: str | None) -> tuple[date | None, date | None]:
        if not value:
            return None, None
        dates = re.findall(r"\d{2}/\d{2}/\d{4}", value)
        if len(dates) >= 2:
            return self._parse_date(dates[0]), self._parse_date(dates[1])
        return None, None

    def _extract_metadata_value(
        self,
        lines: list[str],
        candidates: tuple[str, ...],
    ) -> str | None:
        for line in lines:
            normalized = self._normalize_text(line)
            if not any(candidate in normalized for candidate in candidates):
                continue
            parts = re.split(r"[;:]", line, maxsplit=1)
            if len(parts) == 2:
                return parts[1].strip()
        return None

    def _extract_decimal_metadata(
        self,
        lines: list[str],
        candidates: tuple[str, ...],
    ) -> Decimal | None:
        raw = self._extract_metadata_value(lines, candidates)
        return self._parse_decimal(raw)

    def _extract_line_account_number(self, line: str) -> str | None:
        match = re.search(
            r"conta(?:\s+\w+){0,2}?\s*[:;]?\s*([0-9][A-Za-z0-9\-\/\.]*)",
            line,
            flags=re.IGNORECASE,
        )
        return match.group(1).strip() if match else None

    def _decode_text(self, file_bytes: bytes) -> str:
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin1"):
            try:
                return file_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
        return file_bytes.decode("latin1", errors="ignore")

    def _parse_date(self, value: str | None) -> date | None:
        if not value:
            return None
        value = value.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        return None

    def _parse_decimal_from_text(self, value: str | None) -> Decimal | None:
        if not value:
            return None
        match = re.search(r"-?\d[\d\.\,]*", value)
        if not match:
            return None
        return self._parse_decimal(match.group(0))

    def _parse_decimal(self, value: str | Decimal | None) -> Decimal | None:
        if value is None:
            return None
        if isinstance(value, Decimal):
            return self._quantize(value)

        text = str(value).strip()
        if not text:
            return None

        text = text.replace("R$", "").replace(" ", "")
        sign = -1 if text.startswith("-") else 1
        text = text.lstrip("+-")

        if "," in text and "." in text:
            text = text.replace(".", "").replace(",", ".")
        elif "," in text:
            text = text.replace(".", "").replace(",", ".")

        try:
            return self._quantize(Decimal(text) * sign)
        except Exception:
            return None

    def _normalize_header_token(self, value: str) -> str:
        normalized = self._normalize_text(value)
        replacements = {
            "datalancamento": "data",
            "datamovimento": "data",
            "lancamento": "historico",
            "lancamentohist": "historico",
            "historicolancamento": "historico",
            "historicoevento": "historico",
            "histórico": "historico",
            "descrição": "descricao",
            "descricaolancamento": "descricao",
        }
        return replacements.get(normalized, normalized)

    def _normalize_text(self, value: str) -> str:
        value = value.strip().lower()
        for source, target in (
            ("á", "a"),
            ("à", "a"),
            ("ã", "a"),
            ("â", "a"),
            ("é", "e"),
            ("ê", "e"),
            ("í", "i"),
            ("ó", "o"),
            ("ô", "o"),
            ("õ", "o"),
            ("ú", "u"),
            ("ç", "c"),
        ):
            value = value.replace(source, target)
        return re.sub(r"[^a-z0-9]+", "", value)

    def _normalize_description_for_match(self, value: str | None) -> str:
        if not value:
            return ""
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", self._normalize_text(value))).strip()

    def _description_similarity(self, left: str, right: str) -> float:
        if not left or not right:
            return 0.0
        return SequenceMatcher(a=left, b=right).ratio()

    def _infer_opening_balance(self, rows: list[ParsedStatementRow]) -> Decimal | None:
        if not rows or rows[0].balance_after is None:
            return None
        for row in rows:
            if row.balance_after is not None:
                return self._quantize(row.balance_after - row.amount_signed)
        return None

    def _infer_closing_balance(self, rows: list[ParsedStatementRow]) -> Decimal | None:
        for row in reversed(rows):
            if row.balance_after is not None:
                return self._quantize(row.balance_after)
        return None

    def _quantize(self, value: Decimal, places: str = "0.01") -> Decimal:
        return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)

    def _format_decimal(self, value: Decimal) -> str:
        return f"{self._quantize(value):.2f}"
