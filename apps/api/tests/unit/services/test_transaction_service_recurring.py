"""Unit tests for recurring financial transaction flows."""

from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.core.config import settings
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import PaymentStatus, TransactionType
from app.schemas.finance import TransactionCreate
from app.services.finance.transaction_service import TransactionService


def _build_client() -> Client:
    return Client(
        id=uuid4(),
        user_id=uuid4(),
        razao_social="Empresa Teste",
        cnpj="12.345.678/0001-90",
        email="financeiro@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        gerar_lancamentos_honorarios=True,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.SERVICO,
        status=ClientStatus.ATIVO,
    )


@pytest.mark.asyncio
async def test_create_transaction_with_recurrence_creates_pending_occurrence():
    added_objects = []

    def _add(obj):
        added_objects.append(obj)

    async def _flush():
        for obj in added_objects:
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()

    db = AsyncMock()
    db.add = Mock(side_effect=_add)
    db.flush = AsyncMock(side_effect=_flush)
    db.refresh = AsyncMock()
    db.scalar = AsyncMock(return_value=None)

    service = TransactionService(db)
    client = _build_client()
    service.client_repo = SimpleNamespace(get=AsyncMock(return_value=client))

    created_by_id = uuid4()
    transaction = await service.create_transaction(
        TransactionCreate(
            client_id=client.id,
            transaction_type=TransactionType.DESPESA,
            amount=Decimal("850.00"),
            due_date=date(2026, 3, 30),
            reference_month=date(2026, 3, 1),
            description="Aluguel",
            notes="Contrato do aluguel",
            is_recurring=True,
            recurring_day=5,
        ),
        created_by_id=created_by_id,
    )

    assert transaction.payment_status == PaymentStatus.PENDENTE
    assert transaction.paid_date is None
    assert transaction.payment_method is None
    assert transaction.reference_month == date(2026, 3, 1)
    assert transaction.due_date == date(2026, 3, 5)
    assert transaction.recurring_template_id is not None


@pytest.mark.asyncio
async def test_generate_missing_recurring_transactions_backfills_missing_months():
    client = _build_client()
    template = SimpleNamespace(
        id=uuid4(),
        client_id=client.id,
        created_by_id=uuid4(),
        transaction_type=TransactionType.DESPESA,
        amount=100,
        description="Aluguel",
        category=None,
        notes=None,
        due_day=7,
        start_reference_month=date(2026, 1, 1),
        deleted_at=None,
        is_active=True,
    )

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [template])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [date(2026, 1, 1)])),
        ]
    )

    service = TransactionService(db)
    service.client_repo = SimpleNamespace(get=AsyncMock(return_value=client))
    service._create_missing_occurrence_from_template = AsyncMock(
        side_effect=[SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4())]
    )

    result = await service.generate_missing_recurring_transactions(until_month=date(2026, 3, 1))

    assert service._create_missing_occurrence_from_template.await_count == 2
    assert (
        service._create_missing_occurrence_from_template.await_args_list[0].kwargs["reference_month"]
        == date(2026, 2, 1)
    )
    assert (
        service._create_missing_occurrence_from_template.await_args_list[1].kwargs["reference_month"]
        == date(2026, 3, 1)
    )
    assert result["total_transactions"] == 2


@pytest.mark.asyncio
async def test_bulk_mark_as_paid_allows_manual_honorarios_lookalike(
    monkeypatch: pytest.MonkeyPatch,
):
    office_client_id = uuid4()
    monkeypatch.setattr(settings, "OFFICE_CLIENT_ID", office_client_id, raising=False)

    transaction_id = uuid4()
    manual_honorario = SimpleNamespace(
        id=transaction_id,
        client_id=office_client_id,
        transaction_type=TransactionType.RECEITA,
        description="Honorários - Empresa Teste (12.345.678/0001-90) - 03/2026",
        notes="Lançamento manual avulso",
        payment_status=PaymentStatus.PENDENTE,
        paid_date=None,
        payment_method=None,
    )

    db = AsyncMock()
    db.flush = AsyncMock()

    service = TransactionService(db)
    service.transaction_repo = SimpleNamespace(
        list_by_ids_with_relations=AsyncMock(return_value=[manual_honorario])
    )

    result = await service.bulk_mark_as_paid(
        [transaction_id],
        paid_date=datetime(2026, 3, 31, 12, 0, 0),
        payment_method="pix",
    )

    assert manual_honorario.payment_status == PaymentStatus.PAGO
    assert manual_honorario.payment_method == "pix"
    assert result["succeeded"] == 1
    assert result["failed"] == 0
