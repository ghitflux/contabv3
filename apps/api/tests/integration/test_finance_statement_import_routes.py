"""Integration tests for finance statement import routes."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.bank_account import BankAccount
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.models.user import User


def _build_client(*, user: User | None = None) -> Client:
    return Client(
        id=uuid4(),
        user_id=user.id if user else None,
        razao_social=f"Empresa {uuid4().hex[:6]}",
        nome_fantasia="Empresa Teste",
        cnpj=f"{uuid4().int % 10**14:014d}",
        email=user.email if user else "empresa@test.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        gerar_lancamentos_honorarios=True,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.SERVICO,
        status=ClientStatus.ATIVO,
    )


def _statement_csv() -> bytes:
    return b"""Extrato Conta Corrente
Conta ;12345-6
Per\xc3\xadodo ;01/03/2026 a 31/03/2026
Saldo ;201,67

Data Lan\xc3\xa7amento;Hist\xc3\xb3rico;Descri\xc3\xa7\xc3\xa3o;Valor;Saldo
31/03/2026;Pix enviado;Fornecedor XPTO;-80,00;485,10
30/03/2026;Pix recebido;Cliente ABC;210,00;565,10
"""


@pytest.mark.asyncio
async def test_admin_can_preview_and_commit_statement_import(
    client: AsyncClient,
    session: AsyncSession,
    admin_token: str,
):
    target_client = _build_client()
    session.add(target_client)
    await session.commit()

    preview_response = await client.post(
        "/api/v1/finance/imports/preview",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"client_id": str(target_client.id)},
        files={"file": ("extrato.csv", _statement_csv(), "text/csv")},
    )

    assert preview_response.status_code == 201, preview_response.text
    preview_data = preview_response.json()
    assert preview_data["total_rows"] == 2
    assert preview_data["duplicate_rows"] == 0
    assert len(preview_data["rows"]) == 2

    commit_response = await client.post(
        f"/api/v1/finance/imports/{preview_data['import_id']}/commit",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
          "rows": [
            {
              "row_id": row["id"],
              "is_selected": True,
              "category": "2.1.09" if row["transaction_type"] == "despesa" else "1.1.02",
              "notes": "Importado via teste",
            }
            for row in preview_data["rows"]
          ]
        },
    )

    assert commit_response.status_code == 200, commit_response.text
    commit_data = commit_response.json()
    assert commit_data["imported_count"] == 2
    assert commit_data["skipped_count"] == 0

    transactions = (
        (
            await session.execute(
                select(FinancialTransaction).where(FinancialTransaction.client_id == target_client.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(transactions) == 2
    assert all(transaction.payment_status == PaymentStatus.PAGO for transaction in transactions)
    assert {transaction.transaction_type for transaction in transactions} == {
        TransactionType.RECEITA,
        TransactionType.DESPESA,
    }
    assert all(transaction.bank_account_id for transaction in transactions)
    assert len({transaction.bank_account_id for transaction in transactions}) == 1
    assert {transaction.reference_month for transaction in transactions} == {date(2026, 3, 1)}


@pytest.mark.asyncio
async def test_cliente_can_import_only_to_own_cash_account(
    client: AsyncClient,
    session: AsyncSession,
    cliente_user: User,
    cliente_token: str,
):
    own_client = _build_client(user=cliente_user)
    foreign_client = _build_client()
    own_bank = BankAccount(
        client_id=own_client.id,
        name="Banco Próprio",
        account_number="0001",
        balance=Decimal("0.00"),
    )
    foreign_bank = BankAccount(
        client_id=foreign_client.id,
        name="Banco Terceiro",
        account_number="0002",
        balance=Decimal("0.00"),
    )
    session.add_all([own_client, foreign_client, own_bank, foreign_bank])
    await session.commit()
    await session.refresh(own_bank)
    await session.refresh(foreign_bank)

    own_preview = await client.post(
        "/api/v1/finance/imports/preview",
        headers={"Authorization": f"Bearer {cliente_token}"},
        data={},
        files={"file": ("extrato.csv", _statement_csv(), "text/csv")},
    )
    assert own_preview.status_code == 201, own_preview.text

    forbidden_preview = await client.post(
        "/api/v1/finance/imports/preview",
        headers={"Authorization": f"Bearer {cliente_token}"},
        data={"bank_account_id": str(foreign_bank.id)},
        files={"file": ("extrato.csv", _statement_csv(), "text/csv")},
    )
    assert forbidden_preview.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_import_statement_to_office_cash(
    client: AsyncClient,
    session: AsyncSession,
    admin_token: str,
):
    office_client = _build_client()
    office_client.id = settings.OFFICE_CLIENT_ID
    session.add(office_client)
    await session.commit()

    preview_response = await client.post(
        "/api/v1/finance/imports/preview",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={"office_only": "true"},
        files={"file": ("extrato.csv", _statement_csv(), "text/csv")},
    )
    assert preview_response.status_code == 201, preview_response.text
    preview_data = preview_response.json()

    commit_response = await client.post(
        f"/api/v1/finance/imports/{preview_data['import_id']}/commit",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "rows": [
                {
                    "row_id": row["id"],
                    "is_selected": True,
                    "category": "2.1.09" if row["transaction_type"] == "despesa" else "1.1.02",
                    "notes": "Importado no caixa do escritório",
                }
                for row in preview_data["rows"]
            ]
        },
    )
    assert commit_response.status_code == 200, commit_response.text

    transactions = (
        (
            await session.execute(
                select(FinancialTransaction).where(
                    FinancialTransaction.client_id == settings.OFFICE_CLIENT_ID
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(transactions) == 2
    bank_account = await session.get(BankAccount, transactions[0].bank_account_id)
    assert bank_account is not None
    assert bank_account.client_id is None


@pytest.mark.asyncio
async def test_cash_account_cannot_be_duplicated_or_deleted(
    client: AsyncClient,
    session: AsyncSession,
    admin_token: str,
):
    target_client = _build_client()
    cash_account = BankAccount(
        client_id=target_client.id,
        name="Caixa do Cliente",
        account_number="CAIXA-TESTE",
        balance=Decimal("0.00"),
    )
    session.add_all([target_client, cash_account])
    await session.commit()
    await session.refresh(cash_account)

    duplicate_response = await client.post(
        "/api/v1/bank-accounts",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "client_id": str(target_client.id),
            "name": "Outro Caixa",
            "account_number": "CAIXA-2",
            "balance": 0,
        },
    )
    assert duplicate_response.status_code == 400

    delete_response = await client.delete(
        f"/api/v1/bank-accounts/{cash_account.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_response.status_code == 400
