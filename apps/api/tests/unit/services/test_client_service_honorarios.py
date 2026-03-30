"""Unit tests for honorários creation triggered by client changes."""

from datetime import date
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

import app.services.client as client_service_module
from app.core.config import settings
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.services.client import ClientService


class _FrozenDate(date):
    @classmethod
    def today(cls) -> "_FrozenDate":
        return cls(2026, 3, 30)


def _build_client(*, status: ClientStatus = ClientStatus.ATIVO, honorarios: float = 1500.0) -> Client:
    return Client(
        id=uuid4(),
        user_id=uuid4(),
        razao_social="Empresa Teste",
        cnpj="12.345.678/0001-90",
        email="financeiro@empresa.com",
        honorarios_mensais=honorarios,
        dia_vencimento=31,
        gerar_lancamentos_honorarios=True,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.SERVICO,
        status=status,
    )


@pytest.mark.asyncio
async def test_create_honorarios_transactions_for_client_uses_current_month(
    monkeypatch: pytest.MonkeyPatch,
):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)
    monkeypatch.setattr(client_service_module, "date", _FrozenDate)

    session = AsyncMock()
    session.scalar = AsyncMock(side_effect=[None, None])
    session.add = Mock()

    service = ClientService(session)
    client = _build_client()

    await service._create_honorarios_transactions_for_client(
        client,
        created_by_id=uuid4(),
        trigger_label="ao editar cliente",
    )

    assert session.add.call_count == 2

    created_transactions = [call.args[0] for call in session.add.call_args_list]
    assert {tx.reference_month for tx in created_transactions} == {date(2026, 3, 1)}
    assert {tx.due_date for tx in created_transactions} == {date(2026, 3, 31)}


@pytest.mark.asyncio
async def test_create_honorarios_transactions_for_client_skips_inactive_clients():
    session = AsyncMock()
    session.scalar = AsyncMock()
    session.add = Mock()

    service = ClientService(session)
    client = _build_client(status=ClientStatus.INATIVO)

    await service._create_honorarios_transactions_for_client(
        client,
        created_by_id=uuid4(),
        trigger_label="ao editar cliente",
    )

    session.scalar.assert_not_called()
    session.add.assert_not_called()
