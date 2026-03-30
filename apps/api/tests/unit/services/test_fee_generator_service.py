"""Unit tests for fee generator service."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.core.config import settings
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import TransactionType
from app.services.finance.fee_generator_service import FeeGeneratorService


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


def test_get_first_day_of_next_month():
    assert FeeGeneratorService._get_first_day_of_next_month(date(2026, 2, 1)) == date(2026, 3, 1)
    assert FeeGeneratorService._get_first_day_of_next_month(date(2026, 12, 1)) == date(2027, 1, 1)


def test_resolve_due_date_for_client_clamps_day_to_month():
    assert FeeGeneratorService._resolve_due_date_for_client(date(2026, 2, 1), 31) == date(2026, 2, 28)
    assert FeeGeneratorService._resolve_due_date_for_client(date(2026, 3, 1), 31) == date(2026, 3, 31)
    assert FeeGeneratorService._resolve_due_date_for_client(date(2026, 4, 1), 31) == date(2026, 4, 30)


@pytest.mark.asyncio
async def test_generate_for_client_creates_client_and_office_entries(monkeypatch: pytest.MonkeyPatch):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[None, None])
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.add_all = Mock()

    service = FeeGeneratorService(db)
    client = _build_client()

    transactions = await service._generate_for_client(
        client=client,
        reference_month=date(2026, 2, 1),
        generated_by_id=uuid4(),
    )

    assert len(transactions) == 2

    client_tx = next(tx for tx in transactions if tx.client_id == client.id)
    office_tx = next(tx for tx in transactions if tx.client_id == office_client_id)

    assert client_tx.transaction_type == TransactionType.DESPESA
    assert office_tx.transaction_type == TransactionType.RECEITA
    assert client_tx.due_date == date(2026, 2, 28)
    assert office_tx.due_date == date(2026, 2, 28)

    db.add_all.assert_called_once()
    assert db.refresh.await_count == 2


@pytest.mark.asyncio
async def test_generate_for_client_creates_only_missing_side(monkeypatch: pytest.MonkeyPatch):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[uuid4(), None])
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.add_all = Mock()

    service = FeeGeneratorService(db)
    client = _build_client()

    transactions = await service._generate_for_client(
        client=client,
        reference_month=date(2026, 3, 1),
        generated_by_id=uuid4(),
    )

    assert len(transactions) == 1
    assert transactions[0].client_id == office_client_id
    assert transactions[0].transaction_type == TransactionType.RECEITA


@pytest.mark.asyncio
async def test_generate_monthly_fees_for_specific_client_commits_exact_reference_month(
    monkeypatch: pytest.MonkeyPatch,
):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    db = AsyncMock()
    db.commit = AsyncMock()

    service = FeeGeneratorService(db)
    client = _build_client()

    service.client_repo = SimpleNamespace(get=AsyncMock(return_value=client))
    service._generate_for_client = AsyncMock(
        return_value=[
            SimpleNamespace(client_id=client.id, transaction_type=TransactionType.DESPESA),
            SimpleNamespace(client_id=office_client_id, transaction_type=TransactionType.RECEITA),
        ]
    )

    result = await service.generate_monthly_fees(
        reference_month=date(2026, 3, 1),
        client_id=client.id,
        generated_by_id=uuid4(),
    )

    service._generate_for_client.assert_awaited_once()
    called_kwargs = service._generate_for_client.await_args.kwargs
    assert called_kwargs["reference_month"] == date(2026, 3, 1)

    db.commit.assert_awaited_once()
    assert result["total_clients"] == 1
    assert result["total_transactions"] == 2
    assert result["created_client_entries"] == 1
    assert result["created_office_entries"] == 1


@pytest.mark.asyncio
async def test_generate_monthly_fees_for_selected_clients_uses_exact_reference_month(
    monkeypatch: pytest.MonkeyPatch,
):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    db = AsyncMock()
    db.commit = AsyncMock()

    service = FeeGeneratorService(db)
    client_a = _build_client()
    client_a.razao_social = "Empresa A"
    client_b = _build_client()
    client_b.razao_social = "Empresa B"

    service.client_repo = SimpleNamespace(get=AsyncMock(side_effect=[client_a, client_b]))
    service._generate_for_client = AsyncMock(
        side_effect=[
            [
                SimpleNamespace(client_id=client_a.id, transaction_type=TransactionType.DESPESA),
                SimpleNamespace(client_id=office_client_id, transaction_type=TransactionType.RECEITA),
            ],
            [],
        ]
    )

    result = await service.generate_monthly_fees(
        reference_month=date(2026, 3, 1),
        client_ids=[client_a.id, client_b.id],
        generated_by_id=uuid4(),
    )

    assert service._generate_for_client.await_count == 2
    for await_call in service._generate_for_client.await_args_list:
        assert await_call.kwargs["reference_month"] == date(2026, 3, 1)

    db.commit.assert_awaited_once()
    assert result["total_clients"] == 2
    assert result["total_transactions"] == 2
    assert result["created_client_entries"] == 1
    assert result["created_office_entries"] == 1
    assert result["skipped"] == 1
    assert result["errors"] == 0


@pytest.mark.asyncio
async def test_build_generation_reference_months_returns_current_month_when_no_history():
    db = AsyncMock()
    service = FeeGeneratorService(db)
    client = _build_client()
    service._get_last_generated_reference_month = AsyncMock(return_value=None)

    result = await service._build_generation_reference_months(client, date(2026, 3, 1))

    assert result == [date(2026, 3, 1)]


@pytest.mark.asyncio
async def test_build_generation_reference_months_backfills_gap_until_current_month():
    db = AsyncMock()
    service = FeeGeneratorService(db)
    client = _build_client()
    service._get_last_generated_reference_month = AsyncMock(return_value=date(2026, 1, 1))

    result = await service._build_generation_reference_months(client, date(2026, 3, 1))

    assert result == [date(2026, 2, 1), date(2026, 3, 1)]


@pytest.mark.asyncio
async def test_build_generation_reference_months_rechecks_current_month_when_already_latest():
    db = AsyncMock()
    service = FeeGeneratorService(db)
    client = _build_client()
    service._get_last_generated_reference_month = AsyncMock(return_value=date(2026, 3, 1))

    result = await service._build_generation_reference_months(client, date(2026, 3, 1))

    assert result == [date(2026, 3, 1)]


@pytest.mark.asyncio
async def test_generate_missing_monthly_fees_generates_backfill_sequence(
    monkeypatch: pytest.MonkeyPatch,
):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    client = _build_client()
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: [client])
        )
    )
    db.commit = AsyncMock()

    service = FeeGeneratorService(db)
    service._build_generation_reference_months = AsyncMock(
        return_value=[date(2026, 2, 1), date(2026, 3, 1)]
    )
    service._generate_for_client = AsyncMock(
        side_effect=[
            [
                SimpleNamespace(client_id=client.id, transaction_type=TransactionType.DESPESA),
                SimpleNamespace(client_id=office_client_id, transaction_type=TransactionType.RECEITA),
            ],
            [
                SimpleNamespace(client_id=client.id, transaction_type=TransactionType.DESPESA),
                SimpleNamespace(client_id=office_client_id, transaction_type=TransactionType.RECEITA),
            ],
        ]
    )

    result = await service.generate_missing_monthly_fees(
        reference_month=date(2026, 3, 1),
        generated_by_id=uuid4(),
    )

    assert service._generate_for_client.await_count == 2
    assert service._generate_for_client.await_args_list[0].kwargs["reference_month"] == date(2026, 2, 1)
    assert service._generate_for_client.await_args_list[1].kwargs["reference_month"] == date(2026, 3, 1)
    db.commit.assert_awaited_once()
    assert result["reference_month"] == "2026-03-01"
    assert result["total_transactions"] == 4
    assert result["created_client_entries"] == 2
    assert result["created_office_entries"] == 2
    assert result["errors"] == 0
