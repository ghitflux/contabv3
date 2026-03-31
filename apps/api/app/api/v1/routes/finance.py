"""Financial transactions API routes."""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Annotated, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.core.config import settings
from app.db.models.audit import AuditLog
from app.db.models.finance import PaymentStatus
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.db.repositories.transaction import TransactionRepository
from app.schemas.finance import (
    MonthlyFeeBulkDeleteRequest,
    MonthlyFeeBulkDeleteResponse,
    MonthlyFeeGenerateRequest,
    MonthlyFeeGenerateResponse,
    MonthlyFeePairResponse,
    MonthlyFeePairUpdate,
    MonthlyFeePreviewResponse,
    TransactionBulkIdsRequest,
    TransactionBulkOperationResponse,
    TransactionBulkPayRequest,
    TransactionCancel,
    TransactionCreate,
    TransactionListResponse,
    TransactionMarkAsPaid,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.finance import FeeGeneratorService, FinancialReportService, InvoiceService, TransactionService

router = APIRouter()
FINANCE_UPLOAD_DIR = Path(settings.UPLOAD_DIR) / "finance"
FINANCE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_FINANCE_ATTACHMENT_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".jpg",
    ".jpeg",
    ".png",
}


def _enum_value(value):
    if hasattr(value, "value"):
        return value.value
    return value


def _format_amount(value) -> str | None:
    if value is None:
        return None
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return str(value)


def _transaction_snapshot(transaction) -> dict:
    return {
        "client_id": str(transaction.client_id) if transaction.client_id else None,
        "description": transaction.description,
        "amount": _format_amount(transaction.amount),
        "transaction_type": _enum_value(transaction.transaction_type),
        "payment_status": _enum_value(transaction.payment_status),
        "payment_method": _enum_value(transaction.payment_method) if transaction.payment_method else None,
        "due_date": str(transaction.due_date) if transaction.due_date else None,
        "paid_date": transaction.paid_date.isoformat() if transaction.paid_date else None,
        "reference_month": str(transaction.reference_month) if transaction.reference_month else None,
        "category": transaction.category,
        "notes": transaction.notes,
        "invoice_number": transaction.invoice_number,
        "receipt_url": transaction.receipt_url,
        "recurring_template_id": str(transaction.recurring_template_id)
        if getattr(transaction, "recurring_template_id", None)
        else None,
        "restore_blocked_reason": getattr(transaction, "restore_blocked_reason", None),
    }


def _build_transaction_payload(transaction, summary: str, extra: Optional[dict] = None) -> dict:
    payload = {
        "summary": summary,
        **_transaction_snapshot(transaction),
    }
    if extra:
        payload.update(extra)
    return payload


def _serialize_transaction_response(transaction) -> TransactionResponse:
    return TransactionResponse(
        id=transaction.id,
        client_id=transaction.client_id,
        client_name=transaction.client.razao_social if getattr(transaction, "client", None) else None,
        client_cnpj=transaction.client.cnpj if getattr(transaction, "client", None) else None,
        obligation_id=transaction.obligation_id,
        transaction_type=transaction.transaction_type,
        amount=transaction.amount,
        payment_method=transaction.payment_method,
        payment_status=transaction.payment_status,
        due_date=transaction.due_date,
        paid_date=transaction.paid_date,
        reference_month=transaction.reference_month,
        description=transaction.description,
        category=transaction.category,
        notes=transaction.notes,
        invoice_number=transaction.invoice_number,
        receipt_url=transaction.receipt_url,
        recurring_template_id=transaction.recurring_template_id,
        restore_blocked_reason=transaction.restore_blocked_reason,
        created_by_id=transaction.created_by_id,
        created_at=transaction.created_at,
        updated_at=transaction.updated_at,
        deleted_at=transaction.deleted_at,
    )


async def _get_client_profile(db: AsyncSession, current_user: User):
    client_repo = ClientRepository(db)
    client = await client_repo.get_by_user_id(current_user.id, current_user.email)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return client


def _assert_client_can_manage_transaction(transaction, current_user: User) -> None:
    if transaction.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only manage transactions they created",
        )


def _resolve_finance_attachment_path(receipt_url: str) -> Path:
    normalized = receipt_url.replace("\\", "/").lstrip("/")
    return FINANCE_UPLOAD_DIR / normalized


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    client_id: Optional[UUID] = Query(None),
    payment_status: Optional[PaymentStatus] = Query(None, alias="status"),
    reference_month: Optional[date] = Query(None),
    due_date_from: Optional[date] = Query(None),
    due_date_to: Optional[date] = Query(None),
    include_deleted: bool = Query(False, description="Include soft-deleted transactions"),
    deleted_only: bool = Query(False, description="Return only soft-deleted transactions"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    List financial transactions with filters.

    - Admin/Func: Can see all transactions
    - Client: Can only see their own transactions (including deleted, if requested)
    """
    repo = TransactionRepository(db)

    # If user is client, override client_id filter
    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        client_id = client.id

    if deleted_only:
        include_deleted = True

    transactions, total = await repo.list_with_filters(
        client_id=client_id,
        status=payment_status,
        reference_month=reference_month,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        include_deleted=include_deleted,
        deleted_only=deleted_only,
        skip=skip,
        limit=limit,
    )

    # Enrich with client data
    response_items = []
    for transaction in transactions:
        trans_dict = {
            "id": transaction.id,
            "client_id": transaction.client_id,
            "client_name": transaction.client.razao_social if transaction.client else None,
            "client_cnpj": transaction.client.cnpj if transaction.client else None,
            "obligation_id": transaction.obligation_id,
            "transaction_type": transaction.transaction_type,
            "amount": transaction.amount,
            "payment_method": transaction.payment_method,
            "payment_status": transaction.payment_status,
            "due_date": transaction.due_date,
            "paid_date": transaction.paid_date,
            "reference_month": transaction.reference_month,
            "description": transaction.description,
            "category": transaction.category,
            "notes": transaction.notes,
            "invoice_number": transaction.invoice_number,
            "receipt_url": transaction.receipt_url,
            "recurring_template_id": transaction.recurring_template_id,
            "restore_blocked_reason": transaction.restore_blocked_reason,
            "created_by_id": transaction.created_by_id,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
            "deleted_at": transaction.deleted_at,
        }
        response_items.append(TransactionResponse(**trans_dict))

    return {
        "items": response_items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get transaction by ID."""
    repo = TransactionRepository(db)
    transaction = await repo.get_by_id_with_relations(transaction_id)

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    # Check access: clients can only see their own
    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this transaction",
            )

    return transaction


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Create a new transaction.

    Admin/Func can create for any client.
    Clients can create for their own client.
    """
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        data = data.model_copy(update={"client_id": client.id})
    elif current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can create transactions",
        )

    service = TransactionService(db)

    try:
        transaction = await service.create_transaction(
            data=data,
            created_by_id=current_user.id,
        )
        audit_log = AuditLog(
            user_id=current_user.id,
            action="transaction.create",
            entity="financial_transaction",
            entity_id=str(transaction.id),
            payload=_build_transaction_payload(
                transaction,
                summary=f"Lançamento criado: {transaction.description} - R$ {_format_amount(transaction.amount)}",
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        db.add(audit_log)
        await db.commit()
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Update a transaction.

    Admin/Func: Can update any transaction.
    Clients: Can only update their own transactions.
    """
    service = TransactionService(db)
    repo = TransactionRepository(db)
    before_transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not before_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    # Check access: clients can only update their own transactions
    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if before_transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this transaction",
            )
        _assert_client_can_manage_transaction(before_transaction, current_user)
        if any(field in data.model_fields_set for field in ["payment_status", "payment_method", "paid_date"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin/func can change payment status or baixa details",
            )

    try:
        before_snapshot = _transaction_snapshot(before_transaction)
        transaction = await service.update_transaction(
            transaction_id=transaction_id,
            data=data,
        )
        audit_log = AuditLog(
            user_id=current_user.id,
            action="transaction.update",
            entity="financial_transaction",
            entity_id=str(transaction.id),
            payload=_build_transaction_payload(
                transaction,
                summary=f"Lançamento atualizado: {transaction.description} - R$ {_format_amount(transaction.amount)}",
                extra={
                    "before": before_snapshot,
                    "after": _transaction_snapshot(transaction),
                },
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        db.add(audit_log)
        await db.commit()
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{transaction_id}/pay", response_model=TransactionResponse)
async def mark_as_paid(
    transaction_id: UUID,
    data: TransactionMarkAsPaid,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Mark a transaction as paid.

    Admin/Func can mark any common transaction as paid.
    Clients can mark only their own common transactions as paid.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to mark transactions as paid",
        )

    service = TransactionService(db)
    repo = TransactionRepository(db)
    transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not transaction or transaction.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to mark this transaction as paid",
            )
        _assert_client_can_manage_transaction(transaction, current_user)

    try:
        transaction = await service.mark_as_paid(
            transaction_id=transaction_id,
            paid_date=data.paid_date,
            payment_method=data.payment_method,
            notes=data.notes,
        )
        audit_log = AuditLog(
            user_id=current_user.id,
            action="transaction.mark_paid",
            entity="financial_transaction",
            entity_id=str(transaction.id),
            payload=_build_transaction_payload(
                transaction,
                summary=f"Baixa realizada: {transaction.description} - R$ {_format_amount(transaction.amount)}",
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        db.add(audit_log)
        await db.commit()
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{transaction_id}/cancel", response_model=TransactionResponse)
async def cancel_transaction(
    transaction_id: UUID,
    data: TransactionCancel,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Cancel a transaction.

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can cancel transactions",
        )

    service = TransactionService(db)

    try:
        transaction = await service.cancel_transaction(
            transaction_id=transaction_id,
            reason=data.reason,
        )
        audit_log = AuditLog(
            user_id=current_user.id,
            action="transaction.cancel",
            entity="financial_transaction",
            entity_id=str(transaction.id),
            payload=_build_transaction_payload(
                transaction,
                summary=f"Lançamento cancelado: {transaction.description} - R$ {_format_amount(transaction.amount)}",
                extra={"cancel_reason": data.reason},
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        db.add(audit_log)
        await db.commit()
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Delete a transaction (soft delete).

    Admin/Func: Can delete any transaction.
    Clients: Can only delete their own transactions.
    """
    service = TransactionService(db)
    repo = TransactionRepository(db)
    transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not transaction or transaction.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    # Check access: clients can only delete their own transactions
    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this transaction",
            )
        _assert_client_can_manage_transaction(transaction, current_user)

    transaction_snapshot = _transaction_snapshot(transaction)

    try:
        deleted = await service.delete_transaction(transaction_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    audit_log = AuditLog(
        user_id=current_user.id,
        action="transaction.delete",
        entity="financial_transaction",
        entity_id=str(transaction_id),
        payload={
            "summary": f"Lançamento excluído: {transaction.description} - R$ {_format_amount(transaction.amount)}",
            **transaction_snapshot,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)

    await db.commit()
    return None


@router.post("/{transaction_id}/restore", response_model=TransactionResponse)
async def restore_transaction(
    transaction_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Restore a soft-deleted transaction.

    Admin/Func: Can restore any transaction.
    Clients: Can restore their own transactions.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to restore transactions",
        )

    service = TransactionService(db)
    repo = TransactionRepository(db)
    deleted_transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not deleted_transaction or deleted_transaction.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted transaction not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if deleted_transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to restore this transaction",
            )
        _assert_client_can_manage_transaction(deleted_transaction, current_user)
    if deleted_transaction.restore_blocked_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=deleted_transaction.restore_blocked_reason,
        )

    try:
        restored = await service.restore_transaction(transaction_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted transaction not found",
        )

    transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    audit_log = AuditLog(
        user_id=current_user.id,
        action="transaction.restore",
        entity="financial_transaction",
        entity_id=str(transaction.id),
        payload=_build_transaction_payload(
            transaction,
            summary=f"Lançamento restaurado: {transaction.description} - R$ {_format_amount(transaction.amount)}",
            extra={"restored_from_trash": True},
        ),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)

    await db.commit()
    return transaction


@router.post("/bulk/pay", response_model=TransactionBulkOperationResponse)
async def bulk_pay_transactions(
    data: TransactionBulkPayRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Bulk baixa for receitas and despesas."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can perform bulk baixa",
        )

    repo = TransactionRepository(db)
    before_transactions = await repo.list_by_ids_with_relations(
        data.transaction_ids,
        include_deleted=True,
    )
    before_map = {transaction.id: _transaction_snapshot(transaction) for transaction in before_transactions}

    service = TransactionService(db)
    result = await service.bulk_mark_as_paid(
        data.transaction_ids,
        paid_date=data.paid_date or datetime.utcnow(),
        payment_method=data.payment_method,
        notes=data.notes,
    )

    for transaction in result["transactions"]:
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="transaction.bulk_mark_paid_item",
                entity="financial_transaction",
                entity_id=str(transaction.id),
                payload=_build_transaction_payload(
                    transaction,
                    summary=f"Baixa em massa: {transaction.description} - R$ {_format_amount(transaction.amount)}",
                    extra={
                        "bulk_action": "pay",
                        "before": before_map.get(transaction.id),
                        "after": _transaction_snapshot(transaction),
                    },
                ),
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.bulk_mark_paid",
            entity="financial_transaction",
            entity_id=None,
            payload={
                "summary": (
                    f"Baixa em massa executada: {result['succeeded']} sucesso(s), "
                    f"{result['failed']} falha(s)."
                ),
                "transaction_ids": [str(item) for item in data.transaction_ids],
                "requested": result["requested"],
                "processed": result["processed"],
                "succeeded": result["succeeded"],
                "failed": result["failed"],
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return {
        "success": result["failed"] == 0,
        "action": result["action"],
        "requested": result["requested"],
        "processed": result["processed"],
        "succeeded": result["succeeded"],
        "failed": result["failed"],
        "items": result["items"],
    }


@router.post("/bulk/reopen", response_model=TransactionBulkOperationResponse)
async def bulk_reopen_transactions(
    data: TransactionBulkIdsRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Bulk reopen transactions back to pending."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can reopen transactions in bulk",
        )

    repo = TransactionRepository(db)
    before_transactions = await repo.list_by_ids_with_relations(
        data.transaction_ids,
        include_deleted=True,
    )
    before_map = {transaction.id: _transaction_snapshot(transaction) for transaction in before_transactions}

    service = TransactionService(db)
    result = await service.bulk_reopen_transactions(data.transaction_ids)

    for transaction in result["transactions"]:
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="transaction.bulk_reopen_item",
                entity="financial_transaction",
                entity_id=str(transaction.id),
                payload=_build_transaction_payload(
                    transaction,
                    summary=f"Reabertura em massa: {transaction.description} - R$ {_format_amount(transaction.amount)}",
                    extra={
                        "bulk_action": "reopen",
                        "before": before_map.get(transaction.id),
                        "after": _transaction_snapshot(transaction),
                    },
                ),
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.bulk_reopen",
            entity="financial_transaction",
            entity_id=None,
            payload={
                "summary": (
                    f"Reabertura em massa executada: {result['succeeded']} sucesso(s), "
                    f"{result['failed']} falha(s)."
                ),
                "transaction_ids": [str(item) for item in data.transaction_ids],
                "requested": result["requested"],
                "processed": result["processed"],
                "succeeded": result["succeeded"],
                "failed": result["failed"],
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return {
        "success": result["failed"] == 0,
        "action": result["action"],
        "requested": result["requested"],
        "processed": result["processed"],
        "succeeded": result["succeeded"],
        "failed": result["failed"],
        "items": result["items"],
    }


@router.post("/bulk/delete", response_model=TransactionBulkOperationResponse)
async def bulk_delete_transactions(
    data: TransactionBulkIdsRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Bulk soft delete for common launches."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can delete transactions in bulk",
        )

    repo = TransactionRepository(db)
    before_transactions = await repo.list_by_ids_with_relations(
        data.transaction_ids,
        include_deleted=True,
    )
    before_map = {transaction.id: _transaction_snapshot(transaction) for transaction in before_transactions}

    service = TransactionService(db)
    result = await service.bulk_delete_transactions(data.transaction_ids)

    for transaction in result["transactions"]:
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="transaction.bulk_delete_item",
                entity="financial_transaction",
                entity_id=str(transaction.id),
                payload={
                    "summary": (
                        f"Exclusão em massa: {transaction.description} - R$ {_format_amount(transaction.amount)}"
                    ),
                    "bulk_action": "delete",
                    "before": before_map.get(transaction.id),
                    "after": _transaction_snapshot(transaction),
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.bulk_delete",
            entity="financial_transaction",
            entity_id=None,
            payload={
                "summary": (
                    f"Exclusão em massa executada: {result['succeeded']} sucesso(s), "
                    f"{result['failed']} falha(s)."
                ),
                "transaction_ids": [str(item) for item in data.transaction_ids],
                "requested": result["requested"],
                "processed": result["processed"],
                "succeeded": result["succeeded"],
                "failed": result["failed"],
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return {
        "success": result["failed"] == 0,
        "action": result["action"],
        "requested": result["requested"],
        "processed": result["processed"],
        "succeeded": result["succeeded"],
        "failed": result["failed"],
        "items": result["items"],
    }


@router.post("/{transaction_id}/attachment", response_model=TransactionResponse)
async def upload_transaction_attachment(
    transaction_id: UUID,
    request: Request,
    file: Annotated[UploadFile, File(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Upload or replace the attachment for a transaction."""
    repo = TransactionRepository(db)
    transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not transaction or transaction.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to upload attachments for this transaction",
            )
        _assert_client_can_manage_transaction(transaction, current_user)
    elif current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload attachments",
        )

    original_filename = file.filename or "anexo"
    extension = Path(original_filename).suffix.lower()
    if extension not in ALLOWED_FINANCE_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "File type not allowed. Allowed: "
                f"{', '.join(sorted(ALLOWED_FINANCE_ATTACHMENT_EXTENSIONS))}"
            ),
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE} bytes",
        )

    upload_dir = FINANCE_UPLOAD_DIR / str(transaction.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_base_name = Path(original_filename).name.replace(" ", "_")
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid4())[:8]}_{safe_base_name}"
    file_path = upload_dir / filename

    if transaction.receipt_url:
        previous_path = _resolve_finance_attachment_path(transaction.receipt_url)
        if previous_path.exists() and previous_path.is_file():
            previous_path.unlink()

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    transaction.receipt_url = str(file_path.relative_to(FINANCE_UPLOAD_DIR)).replace("\\", "/")

    audit_log = AuditLog(
        user_id=current_user.id,
        action="transaction.attachment_upload",
        entity="financial_transaction",
        entity_id=str(transaction.id),
        payload=_build_transaction_payload(
            transaction,
            summary=f"Anexo enviado para lançamento: {transaction.description}",
            extra={
                "attachment_filename": original_filename,
                "attachment_size": len(contents),
            },
        ),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.get("/{transaction_id}/attachment")
async def download_transaction_attachment(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Download the attachment linked to a transaction."""
    repo = TransactionRepository(db)
    transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not transaction or transaction.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    if not transaction.receipt_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this attachment",
            )
    elif current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access attachments",
        )

    file_path = _resolve_finance_attachment_path(transaction.receipt_url)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment file not found",
        )

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=os.path.basename(file_path),
    )


@router.post("/fees/preview", response_model=MonthlyFeePreviewResponse)
async def preview_monthly_fees(
    data: MonthlyFeeGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Preview honorários generation for a competence without creating data."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can preview fees",
        )

    service = FeeGeneratorService(db)
    try:
        return await service.preview_monthly_fees(
            reference_month=data.reference_month,
            client_id=data.client_id,
            client_ids=data.client_ids,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/fees/generate", response_model=MonthlyFeeGenerateResponse)
async def generate_monthly_fees(
    data: MonthlyFeeGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Generate monthly fees for clients.

    Admin/Func only.
    Can generate for one client or all active clients.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can generate fees",
        )

    service = FeeGeneratorService(db)

    try:
        result = await service.generate_monthly_fees(
            reference_month=data.reference_month,
            client_id=data.client_id,
            client_ids=data.client_ids,
            generated_by_id=current_user.id,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/fees/bulk-delete", response_model=MonthlyFeeBulkDeleteResponse)
async def bulk_delete_monthly_fees(
    data: MonthlyFeeBulkDeleteRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete honorários in pair and block regeneration for the competence."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can delete fees in bulk",
        )

    service = FeeGeneratorService(db)
    result = await service.bulk_delete_monthly_fees(
        office_transaction_ids=data.office_transaction_ids,
        deleted_by_id=current_user.id,
        reason=data.reason,
    )

    for item in result["items"]:
        if not item["success"]:
            continue
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="transaction.monthly_fee_bulk_delete_item",
                entity="financial_transaction",
                entity_id=str(item["office_transaction_id"]),
                payload={
                    "summary": "Honorário excluído em par com bloqueio de competência.",
                    "office_transaction_id": str(item["office_transaction_id"]),
                    "client_id": str(item["client_id"]) if item.get("client_id") else None,
                    "reference_month": item["reference_month"].isoformat()
                    if item.get("reference_month")
                    else None,
                    "success": item["success"],
                    "deleted_office_entry": item["deleted_office_entry"],
                    "deleted_client_entry": item["deleted_client_entry"],
                    "blocked": item["blocked"],
                    "detail": item["detail"],
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.monthly_fee_bulk_delete",
            entity="financial_transaction",
            entity_id=None,
            payload={
                "summary": (
                    f"Exclusão em massa de honorários: {result['succeeded']} sucesso(s), "
                    f"{result['failed']} falha(s), {result['blocked_competences']} competência(s) bloqueada(s)."
                ),
                "office_transaction_ids": [str(item) for item in data.office_transaction_ids],
                "requested": result["requested"],
                "succeeded": result["succeeded"],
                "failed": result["failed"],
                "blocked_competences": result["blocked_competences"],
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return {
        "success": result["failed"] == 0,
        "requested": result["requested"],
        "succeeded": result["succeeded"],
        "failed": result["failed"],
        "blocked_competences": result["blocked_competences"],
        "items": result["items"],
    }


@router.post("/fees/{office_transaction_id}/pay", response_model=MonthlyFeePairResponse)
async def mark_monthly_fee_as_paid(
    office_transaction_id: UUID,
    data: TransactionMarkAsPaid,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Mark both sides of an automatic honorários pair as paid."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can mark automatic fees as paid",
        )

    service = FeeGeneratorService(db)
    repo = TransactionRepository(db)

    try:
        office_before, _, client_before, _ = await service._load_auto_fee_pair(office_transaction_id)
        before_office_snapshot = _transaction_snapshot(office_before)
        before_client_snapshot = _transaction_snapshot(client_before) if client_before else None

        result = await service.mark_monthly_fee_as_paid(
            office_transaction_id=office_transaction_id,
            paid_date=data.paid_date,
            payment_method=data.payment_method,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    office_transaction = await repo.get_by_id_with_relations(office_transaction_id, include_deleted=True)
    client_transaction = None
    if result["client_transaction"] is not None:
        client_transaction = await repo.get_by_id_with_relations(
            result["client_transaction"].id,
            include_deleted=True,
        )

    if office_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Honorário do escritório não encontrado após a baixa",
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.monthly_fee_pay",
            entity="financial_transaction",
            entity_id=str(office_transaction.id),
            payload={
                "summary": (
                    f"Baixa de honorário automático: {office_transaction.description} - "
                    f"R$ {_format_amount(office_transaction.amount)}"
                ),
                "before_office": before_office_snapshot,
                "after_office": _transaction_snapshot(office_transaction),
                "before_client": before_client_snapshot,
                "after_client": _transaction_snapshot(client_transaction) if client_transaction else None,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return MonthlyFeePairResponse(
        success=True,
        client_id=result["client_id"],
        reference_month=result["reference_month"],
        office_transaction=_serialize_transaction_response(office_transaction),
        client_transaction=_serialize_transaction_response(client_transaction)
        if client_transaction
        else None,
        blocked_competence=False,
        detail=None,
    )


@router.put("/fees/{office_transaction_id}", response_model=MonthlyFeePairResponse)
async def update_monthly_fee_pair(
    office_transaction_id: UUID,
    data: MonthlyFeePairUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update editable fields for both sides of an automatic honorários pair."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can edit automatic fees",
        )

    service = FeeGeneratorService(db)
    repo = TransactionRepository(db)

    try:
        office_before, _, client_before, _ = await service._load_auto_fee_pair(office_transaction_id)
        before_office_snapshot = _transaction_snapshot(office_before)
        before_client_snapshot = _transaction_snapshot(client_before) if client_before else None

        result = await service.update_monthly_fee_pair(
            office_transaction_id=office_transaction_id,
            data=data,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    office_transaction = await repo.get_by_id_with_relations(office_transaction_id, include_deleted=True)
    client_transaction = None
    if result["client_transaction"] is not None:
        client_transaction = await repo.get_by_id_with_relations(
            result["client_transaction"].id,
            include_deleted=True,
        )

    if office_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Honorário do escritório não encontrado após a edição",
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.monthly_fee_update",
            entity="financial_transaction",
            entity_id=str(office_transaction.id),
            payload={
                "summary": (
                    f"Honorário automático atualizado: {office_transaction.description} - "
                    f"R$ {_format_amount(office_transaction.amount)}"
                ),
                "before_office": before_office_snapshot,
                "after_office": _transaction_snapshot(office_transaction),
                "before_client": before_client_snapshot,
                "after_client": _transaction_snapshot(client_transaction) if client_transaction else None,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return MonthlyFeePairResponse(
        success=True,
        client_id=result["client_id"],
        reference_month=result["reference_month"],
        office_transaction=_serialize_transaction_response(office_transaction),
        client_transaction=_serialize_transaction_response(client_transaction)
        if client_transaction
        else None,
        blocked_competence=False,
        detail=None,
    )


@router.delete("/fees/{office_transaction_id}", response_model=MonthlyFeePairResponse)
async def delete_monthly_fee_pair(
    office_transaction_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete one automatic honorários pair and block regeneration for the competence."""
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can delete automatic fees",
        )

    service = FeeGeneratorService(db)
    repo = TransactionRepository(db)

    try:
        office_before, _, client_before, _ = await service._load_auto_fee_pair(
            office_transaction_id,
            require_client_pair=False,
        )
        before_office_snapshot = _transaction_snapshot(office_before)
        before_client_snapshot = _transaction_snapshot(client_before) if client_before else None

        result = await service.delete_monthly_fee_pair(
            office_transaction_id=office_transaction_id,
            deleted_by_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    office_transaction = await repo.get_by_id_with_relations(office_transaction_id, include_deleted=True)
    client_transaction = None
    if result["client_transaction"] is not None:
        client_transaction = await repo.get_by_id_with_relations(
            result["client_transaction"].id,
            include_deleted=True,
        )

    if office_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Honorário do escritório não encontrado após a exclusão",
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="transaction.monthly_fee_delete",
            entity="financial_transaction",
            entity_id=str(office_transaction.id),
            payload={
                "summary": "Honorário automático excluído com bloqueio da competência.",
                "before_office": before_office_snapshot,
                "after_office": _transaction_snapshot(office_transaction),
                "before_client": before_client_snapshot,
                "after_client": _transaction_snapshot(client_transaction) if client_transaction else None,
                "blocked_competence": True,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return MonthlyFeePairResponse(
        success=True,
        client_id=result["client_id"],
        reference_month=result["reference_month"],
        office_transaction=_serialize_transaction_response(office_transaction),
        client_transaction=_serialize_transaction_response(client_transaction)
        if client_transaction
        else None,
        blocked_competence=True,
        detail=result.get("detail"),
    )


# Reports endpoints
@router.get("/reports/dashboard", response_model=dict)
async def get_dashboard_kpis(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Get financial dashboard KPIs.

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can view financial reports",
        )

    service = FinancialReportService(db)
    return await service.get_dashboard_kpis()


@router.get("/reports/receivables-aging", response_model=dict)
async def get_receivables_aging(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Get receivables aging report.

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can view financial reports",
        )

    service = FinancialReportService(db)
    return await service.get_receivables_aging_report()


@router.get("/reports/revenue-by-period", response_model=dict)
async def get_revenue_by_period(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_month: date = Query(...),
    end_month: date = Query(...),
):
    """
    Get revenue by period report.

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can view financial reports",
        )

    service = FinancialReportService(db)
    return await service.get_revenue_by_period(
        start_month=start_month,
        end_month=end_month,
    )


@router.get("/reports/client/{client_id}", response_model=dict)
async def get_client_financial_summary(
    client_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Get financial summary for a specific client.

    Admin/Func can view any client.
    Clients can only view their own data.
    """
    # Check access
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or str(client.id) != str(client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this client's financial data",
            )

    service = FinancialReportService(db)
    try:
        return await service.get_client_financial_summary(client_id=client_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Invoice/PDF endpoints
@router.get("/{transaction_id}/invoice/pdf")
async def generate_invoice_pdf(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Generate invoice PDF for a transaction.

    Admin/Func can generate for any transaction.
    Clients can only generate for their own transactions.
    """
    # Check access
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        transaction_repo = TransactionRepository(db)

        transaction = await transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this invoice",
            )

    service = InvoiceService(db)
    try:
        pdf_bytes = await service.generate_invoice_pdf(
            transaction_id=transaction_id,
            save_to_file=True,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=invoice_{transaction_id}.pdf"
            },
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{transaction_id}/receipt/pdf")
async def generate_receipt_pdf(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Generate payment receipt PDF for a paid transaction.

    Admin/Func can generate for any transaction.
    Clients can only generate for their own transactions.
    """
    # Check access
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        transaction_repo = TransactionRepository(db)

        transaction = await transaction_repo.get_by_id(transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or transaction.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this receipt",
            )

    service = InvoiceService(db)
    try:
        pdf_bytes = await service.generate_receipt_pdf(
            transaction_id=transaction_id,
            save_to_file=True,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=receipt_{transaction_id}.pdf"
            },
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
