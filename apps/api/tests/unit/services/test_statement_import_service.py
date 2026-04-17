"""Unit tests for statement import service."""

from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
import sys

import pytest

from app.db.models.finance import (
    StatementImport,
    StatementImportFormat,
    StatementImportRow,
    StatementImportStatus,
    TransactionType,
)
from app.services.finance.statement_import_service import StatementImportService


def _build_service() -> StatementImportService:
    db = AsyncMock()
    db.flush = AsyncMock()
    return StatementImportService(db)


def test_parse_csv_statement_supports_metadata_and_br_amounts():
    service = _build_service()
    payload = """Extrato Conta Corrente
Conta ;320406385
Período ;01/03/2026 a 31/03/2026
Saldo ;201,67

Data Lançamento;Histórico;Descrição;Valor;Saldo
31/03/2026;Pix enviado;Fornecedor XPTO;-80,00;485,10
30/03/2026;Pix recebido;Cliente ABC;250,00;565,10
""".encode("utf-8")

    parsed = service._parse_csv_statement(payload)

    assert parsed.source_format == StatementImportFormat.CSV
    assert parsed.detected_account_number == "320406385"
    assert parsed.period_start == date(2026, 3, 1)
    assert parsed.period_end == date(2026, 3, 31)
    assert parsed.opening_balance == Decimal("201.67")
    assert parsed.closing_balance == Decimal("565.10")
    assert len(parsed.rows) == 2
    assert parsed.rows[0].transaction_type == TransactionType.DESPESA
    assert parsed.rows[0].amount_signed == Decimal("-80.00")
    assert parsed.rows[1].transaction_type == TransactionType.RECEITA
    assert parsed.rows[1].amount_signed == Decimal("250.00")


def test_parse_ofx_statement_extracts_transactions():
    service = _build_service()
    payload = """OFXHEADER:100
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <FI>
        <ORG>Banco Teste
      </FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKACCTFROM>
          <ACCTID>12345-6
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260301
          <DTEND>20260331
          <STMTTRN>
            <DTPOSTED>20260310
            <TRNAMT>-80.00
            <NAME>PIX ENVIADO
            <MEMO>Fornecedor XPTO
          </STMTTRN>
          <STMTTRN>
            <DTPOSTED>20260311
            <TRNAMT>210.35
            <NAME>PIX RECEBIDO
            <MEMO>Cliente ABC
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>330.35
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
""".encode("latin1")

    parsed = service._parse_ofx_statement(payload)

    assert parsed.detected_bank_name == "Banco Teste"
    assert parsed.detected_account_number == "12345-6"
    assert parsed.period_start == date(2026, 3, 1)
    assert parsed.period_end == date(2026, 3, 31)
    assert parsed.closing_balance == Decimal("330.35")
    assert len(parsed.rows) == 2
    assert parsed.rows[0].transaction_type == TransactionType.DESPESA
    assert parsed.rows[1].transaction_type == TransactionType.RECEITA


def test_parse_pdf_statement_requires_native_text(monkeypatch: pytest.MonkeyPatch):
    service = _build_service()

    class _BlankReader:
        pages = [SimpleNamespace(extract_text=lambda: " ")]

    monkeypatch.setitem(
        sys.modules,
        "pypdf",
        SimpleNamespace(PdfReader=lambda *_args, **_kwargs: _BlankReader()),
    )

    with pytest.raises(ValueError, match="texto nativo"):
        service._parse_pdf_statement(b"%PDF-1.4")


def test_parse_pdf_statement_extracts_rows(monkeypatch: pytest.MonkeyPatch):
    service = _build_service()
    sample_text = """
Extrato Conta Corrente
Conta 12345-6
Período 01/03/2026 a 31/03/2026
31/03/2026 Pix enviado Fornecedor XPTO -80,00 485,10
30/03/2026 Pix recebido Cliente ABC 210,00 565,10
"""

    class _Reader:
        pages = [SimpleNamespace(extract_text=lambda: sample_text)]

    monkeypatch.setitem(
        sys.modules,
        "pypdf",
        SimpleNamespace(PdfReader=lambda *_args, **_kwargs: _Reader()),
    )

    parsed = service._parse_pdf_statement(b"%PDF-1.4")

    assert parsed.detected_account_number == "12345-6"
    assert parsed.period_start == date(2026, 3, 1)
    assert parsed.period_end == date(2026, 3, 31)
    assert len(parsed.rows) == 2
    assert parsed.rows[0].amount_signed == Decimal("-80.00")
    assert parsed.rows[1].amount_signed == Decimal("210.00")


def test_duplicate_detection_matches_existing_and_batch_rows():
    service = _build_service()
    row = SimpleNamespace(
        transaction_date=date(2026, 3, 10),
        transaction_type=TransactionType.DESPESA,
        amount_signed=Decimal("-80.00"),
        description="Fornecedor XPTO",
    )
    existing = SimpleNamespace(
        due_date=date(2026, 3, 10),
        transaction_type=TransactionType.DESPESA,
        amount=Decimal("80.00"),
        description="Fornecedor XPTO",
    )

    assert service._find_existing_duplicate_reason(row, [existing]) is not None
    assert service._find_batch_duplicate_reason(row, [row]) is not None


@pytest.mark.asyncio
async def test_commit_import_creates_paid_transactions():
    service = _build_service()
    import_id = uuid4()
    row_id = uuid4()
    statement_import = StatementImport(
        id=import_id,
        client_id=uuid4(),
        bank_account_id=uuid4(),
        created_by_id=uuid4(),
        source_format=StatementImportFormat.CSV,
        status=StatementImportStatus.PREVIEW,
        original_filename="extrato.csv",
        total_rows=1,
        duplicate_rows=0,
        imported_rows=0,
        rows=[],
    )
    row = StatementImportRow(
        id=row_id,
        statement_import_id=import_id,
        line_number=1,
        transaction_date=date(2026, 3, 31),
        description="Cliente ABC",
        raw_description="Pix recebido | Cliente ABC",
        amount_signed=Decimal("210.00"),
        balance_after=Decimal("565.10"),
        transaction_type=TransactionType.RECEITA,
        confidence=Decimal("1.000"),
        is_selected=True,
        duplicate_suspected=False,
        category="1.1.02",
        notes="Observação",
    )
    statement_import.rows = [row]

    service.get_import = AsyncMock(return_value=statement_import)
    created_transaction = SimpleNamespace(id=uuid4())
    service.transaction_service.create_transaction = AsyncMock(return_value=created_transaction)

    _, transactions, skipped_count, duplicate_skipped_count = await service.commit_import(
        import_id=import_id,
        rows_payload={row_id: (True, "1.1.02", "Observação")},
        committed_by_id=uuid4(),
    )

    assert len(transactions) == 1
    assert skipped_count == 0
    assert duplicate_skipped_count == 0
    assert row.committed_transaction_id == created_transaction.id
    call = service.transaction_service.create_transaction.await_args
    payload = call.args[0]
    assert payload.payment_status == "pago"
    assert payload.bank_account_id == statement_import.bank_account_id
    assert payload.reference_month == date(2026, 3, 1)
    assert payload.amount == Decimal("210.00")
    assert payload.description == "Cliente ABC"
    assert isinstance(payload.paid_date, datetime)
