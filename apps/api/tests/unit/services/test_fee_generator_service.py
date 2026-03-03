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
    assert client_tx.due_date == date(2026, 2, 1)
    assert office_tx.due_date == date(2026, 2, 1)

    db.add_all.assert_called_once()
    assert db.refresh.await_count == 2


@pytest.mark.asyncio
async def test_generate_for_client_creates_only_missing_side(monkeypatch: pytest.MonkeyPatch):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[uuid4(), None])  # Client tx exists, office tx missing
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
async def test_generate_monthly_fees_for_specific_client_commits(monkeypatch: pytest.MonkeyPatch):
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
    assert called_kwargs["reference_month"] == date(2026, 4, 1)

    db.commit.assert_awaited_once()
    assert result["total_clients"] == 1
    assert result["total_transactions"] == 2
    assert result["created_client_entries"] == 1
    assert result["created_office_entries"] == 1


@pytest.mark.asyncio
async def test_generate_monthly_fees_for_selected_clients(monkeypatch: pytest.MonkeyPatch):
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
        assert await_call.kwargs["reference_month"] == date(2026, 4, 1)

    db.commit.assert_awaited_once()
    assert result["total_clients"] == 2
    assert result["total_transactions"] == 2
    assert result["created_client_entries"] == 1
    assert result["created_office_entries"] == 1
    assert result["skipped"] == 1
    assert result["errors"] == 0


@pytest.mark.asyncio
async def test_get_generation_preview_returns_full_selected_list(monkeypatch: pytest.MonkeyPatch):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    client_a = _build_client()
    client_a.razao_social = "Empresa A"
    client_a.cnpj = "11.111.111/0001-11"
    client_b = _build_client()
    client_b.razao_social = "Empresa B"
    client_b.cnpj = "22.222.222/0001-22"

    db = AsyncMock()
    db.scalar = AsyncMock(return_value=None)
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(
                all=lambda: [client_a, client_b]
            )
        )
    )

    service = FeeGeneratorService(db)
    result = await service.get_generation_preview(
        reference_month=date(2026, 2, 1),
        client_ids=[client_a.id, client_b.id],
    )

    assert result["reference_month"] == "2026-03-01"
    assert result["would_generate_count"] == 2
    assert result["would_generate_entries"] == 4
    assert len(result["clients"]) == 2
    assert result["has_more"] is False
    assert result["clients"][0]["client_cnpj"]
    assert result["clients"][1]["client_cnpj"]
