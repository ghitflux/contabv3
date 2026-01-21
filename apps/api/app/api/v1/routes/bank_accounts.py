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

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])


def _format_balance(balance: Decimal) -> str:
    return f"{balance:.2f}"


@router.get("", response_model=BankAccountListResponse, status_code=status.HTTP_200_OK)
async def list_bank_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
    client_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> BankAccountListResponse:
    """
    List bank accounts.

    - Admin/Func: Can see all or filter by client
    - Client: Can only see their own
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

    repo = BankAccountRepository(db)
    items, total = await repo.list_with_filters(client_id=client_id, skip=skip, limit=limit)

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
    Create bank account.

    - Admin/Func: Can create for any client
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

    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id is required",
        )

    client_repo = ClientRepository(db)
    client = await client_repo.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    bank = BankAccount(
        client_id=client_id,
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
            "client_id": str(bank.client_id),
            "summary": f"Banco criado: {bank.name} ({bank.account_number}) - Saldo {_format_balance(bank.balance)}",
            "name": bank.name,
            "account_number": bank.account_number,
            "balance": _format_balance(bank.balance),
            "accounting_account": bank.accounting_account,
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
    """
    Update bank account.
    """
    repo = BankAccountRepository(db)
    bank = await repo.get_by_id(bank_id)
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or bank.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this bank account",
            )

    before = {
        "name": bank.name,
        "account_number": bank.account_number,
        "balance": _format_balance(bank.balance),
        "accounting_account": bank.accounting_account,
    }

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bank, key, value)

    bank = await repo.update(bank)

    audit_log = AuditLog(
        user_id=current_user.id,
        action="bank_account.update",
        entity="bank_account",
        entity_id=str(bank.id),
        payload={
            "client_id": str(bank.client_id),
            "summary": f"Banco atualizado: {bank.name} ({bank.account_number}) - Saldo {_format_balance(bank.balance)}",
            "before": before,
            "after": {
                "name": bank.name,
                "account_number": bank.account_number,
                "balance": _format_balance(bank.balance),
                "accounting_account": bank.accounting_account,
            },
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
    """
    Delete bank account.
    """
    repo = BankAccountRepository(db)
    bank = await repo.get_by_id(bank_id)
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or bank.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this bank account",
            )

    audit_log = AuditLog(
        user_id=current_user.id,
        action="bank_account.delete",
        entity="bank_account",
        entity_id=str(bank.id),
        payload={
            "client_id": str(bank.client_id),
            "summary": f"Banco removido: {bank.name} ({bank.account_number}) - Saldo {_format_balance(bank.balance)}",
            "name": bank.name,
            "account_number": bank.account_number,
            "balance": _format_balance(bank.balance),
            "accounting_account": bank.accounting_account,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)

    deleted = await repo.delete(bank_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found",
        )

    await db.commit()
    return None
