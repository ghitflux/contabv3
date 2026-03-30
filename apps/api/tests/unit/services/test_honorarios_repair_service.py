"""Unit tests for honorários repair service."""

from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.services.finance.honorarios_repair_service import HonorariosRepairService


def _build_client() -> Client:
    return Client(
        id=uuid4(),
        user_id=uuid4(),
        razao_social="Empresa Teste",
        cnpj="12.345.678/0001-90",
        email="financeiro@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=31,
        gerar_lancamentos_honorarios=True,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.SERVICO,
        status=ClientStatus.ATIVO,
    )


def _build_transaction(client_id, description: str, notes: str) -> FinancialTransaction:
    return FinancialTransaction(
        id=uuid4(),
        client_id=client_id,
        created_by_id=uuid4(),
        transaction_type=TransactionType.DESPESA,
        amount=1500.00,
        payment_status=PaymentStatus.PENDENTE,
        due_date=date(2026, 4, 30),
        reference_month=date(2026, 4, 1),
        description=description,
        notes=notes,
        created_at=datetime(2026, 3, 1, 0, 10, 0),
    )


@pytest.mark.asyncio
async def test_repair_shifted_honorarios_updates_reference_due_date_and_description():
    client = _build_client()
    transaction = _build_transaction(
        client.id,
        "Honorários do escritório - 04/2026",
        "Gerado automaticamente em 01/03/2026 (honorários recorrentes).",
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: [transaction])
        )
    )
    db.get = AsyncMock(return_value=client)
    db.scalar = AsyncMock(return_value=None)
    db.commit = AsyncMock()

    service = HonorariosRepairService(db)
    result = await service.repair_shifted_honorarios()

    assert result["updated"] == 1
    assert result["skipped"] == 0
    assert result["conflicts"] == []
    assert transaction.reference_month == date(2026, 3, 1)
    assert transaction.due_date == date(2026, 3, 31)
    assert transaction.description == "Honorários do escritório - 03/2026"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_repair_shifted_honorarios_does_not_touch_manual_entries():
    client = _build_client()
    transaction = _build_transaction(
        client.id,
        "Honorários do escritório - 04/2026",
        "Lançamento manual ajustado pelo financeiro.",
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: [transaction])
        )
    )
    db.commit = AsyncMock()

    service = HonorariosRepairService(db)
    result = await service.repair_shifted_honorarios()

    assert result["updated"] == 0
    assert result["skipped"] == 1
    assert result["conflicts"] == []
    assert transaction.reference_month == date(2026, 4, 1)
    assert transaction.description == "Honorários do escritório - 04/2026"


@pytest.mark.asyncio
async def test_repair_shifted_honorarios_reports_conflict_when_target_month_exists():
    client = _build_client()
    transaction = _build_transaction(
        client.id,
        "Honorários do escritório - 04/2026",
        "Gerado automaticamente em 01/03/2026 (honorários recorrentes).",
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: [transaction])
        )
    )
    db.get = AsyncMock(return_value=client)
    db.scalar = AsyncMock(return_value=uuid4())
    db.commit = AsyncMock()

    service = HonorariosRepairService(db)
    result = await service.repair_shifted_honorarios()

    assert result["updated"] == 0
    assert len(result["conflicts"]) == 1
    assert result["conflicts"][0]["reason"] == "target_month_already_exists"
    assert transaction.reference_month == date(2026, 4, 1)
    assert transaction.description == "Honorários do escritório - 04/2026"
