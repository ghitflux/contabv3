"""
Bank account routes.
"""

from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.audit import AuditLog
from app.db.models.bank_account import BankAccount
from app.db.models.user import User, UserRole
from app.db.repositories.bank_account import BankAccountRepository
from app.db.repositories.client import ClientRepository
from app.schemas.bank_account import (
    BankAccountCreate,
    BankAccountListResponse,
    BankAccountResponse,
    BankAccountUpdate,
)
from app.services.finance.cash_account_service import CashAccountService

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])


def _format_balance(balance: Decimal) -> str:
    return f"{balance:.2f}"


@router.get("", response_model=BankAccountListResponse, status_code=status.HTTP_200_OK)
async def list_bank_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
    client_id: Optional[UUID] = Query(None),
    office_only: bool = Query(False, description="List only office cash account (client_id=null)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> BankAccountListResponse:
    """
    List cash accounts.

    - Admin/Func: Can see all, filter by client, or see office cash (office_only=true)
    - Client: Can only see their own cash
    """
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        client_id = client.id
        office_only = False  # Clients cannot see office accounts

    cash_service = CashAccountService(db)
    if client_id and cash_service.is_office_client(client_id):
        client_id = None
        office_only = True

    repo = BankAccountRepository(db)
    items, total = await repo.list_with_filters(
        client_id=client_id,
        office_only=office_only,
        skip=skip,
        limit=limit,
    )

    return BankAccountListResponse(
        items=[BankAccountResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    data: BankAccountCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> BankAccountResponse:
    """
    Create a cash account only when the owner still has none.

    - Admin/Func: Can create for any client or office (client_id=null)
    - Client: Can only create for own client
    """
    client_id = data.client_id

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        client_id = client.id

    if current_user.role == UserRole.CLIENTE and not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id is required",
        )

    # If client_id is provided, validate it exists
    if client_id:
        client_repo = ClientRepository(db)
        client = await client_repo.get(client_id)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )

    cash_service = CashAccountService(db)
    is_office_cash = client_id is None or cash_service.is_office_client(client_id)
    existing_items, _ = await BankAccountRepository(db).list_with_filters(
        client_id=None if is_office_cash else client_id,
        office_only=is_office_cash,
        skip=0,
        limit=1,
    )
    if existing_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um caixa para este escopo.",
        )

    bank = BankAccount(
        client_id=None if is_office_cash else client_id,
        name=data.name,
        account_number=data.account_number,
        balance=data.balance,
        accounting_account=data.accounting_account,
    )

    repo = BankAccountRepository(db)
    bank = await repo.create(bank)

    audit_log = AuditLog(
        user_id=current_user.id,
        action="bank_account.create",
        entity="bank_account",
        entity_id=str(bank.id),
        payload={
            "client_id": str(bank.client_id) if bank.client_id else None,
            "summary": f"Caixa criado: {bank.name} - Saldo {_format_balance(bank.balance)}",
            "name": bank.name,
            "account_number": bank.account_number,
            "balance": _format_balance(bank.balance),
            "accounting_account": bank.accounting_account,
            "is_office_account": bank.client_id is None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(bank)

    return BankAccountResponse.model_validate(bank)


@router.put("/{bank_id}", response_model=BankAccountResponse, status_code=status.HTTP_200_OK)
async def update_bank_account(
    bank_id: UUID,
    data: BankAccountUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> BankAccountResponse:
    """Update editable cash account fields."""
    repo = BankAccountRepository(db)
    bank = await repo.get_by_id(bank_id)
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caixa não encontrado",
        )

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or bank.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this cash account",
            )

    before = {
        "name": bank.name,
        "account_number": bank.account_number,
        "balance": _format_balance(bank.balance),
        "accounting_account": bank.accounting_account,
    }

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "account_number":
            continue
        setattr(bank, key, value)

    bank = await repo.update(bank)

    audit_log = AuditLog(
        user_id=current_user.id,
        action="bank_account.update",
        entity="bank_account",
        entity_id=str(bank.id),
        payload={
            "client_id": str(bank.client_id) if bank.client_id else None,
            "summary": f"Caixa atualizado: {bank.name} - Saldo {_format_balance(bank.balance)}",
            "before": before,
            "after": {
                "name": bank.name,
                "account_number": bank.account_number,
                "balance": _format_balance(bank.balance),
                "accounting_account": bank.accounting_account,
            },
            "is_office_account": bank.client_id is None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(bank)

    return BankAccountResponse.model_validate(bank)


@router.delete("/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_account(
    bank_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Cash accounts are mandatory and cannot be deleted."""
    repo = BankAccountRepository(db)
    bank = await repo.get_by_id(bank_id)
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caixa não encontrado",
        )

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or bank.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this cash account",
            )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="O caixa único não pode ser excluído.",
    )
