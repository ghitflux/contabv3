"""Financial transactions API routes."""

from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.finance import PaymentStatus
from app.db.models.audit import AuditLog
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.db.repositories.transaction import TransactionRepository
from app.schemas.finance import (
    MonthlyFeeGenerateRequest,
    MonthlyFeeGenerateResponse,
    TransactionCancel,
    TransactionCreate,
    TransactionListResponse,
    TransactionMarkAsPaid,
    TransactionResponse,
    TransactionUpdate,
)
from fastapi.responses import Response
from app.services.finance import FeeGeneratorService, FinancialReportService, InvoiceService, TransactionService

router = APIRouter()


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
    }


def _build_transaction_payload(transaction, summary: str, extra: Optional[dict] = None) -> dict:
    payload = {
        "summary": summary,
        **_transaction_snapshot(transaction),
    }
    if extra:
        payload.update(extra)
    return payload


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
    - Client: Can only see their own transactions
    """
    repo = TransactionRepository(db)

    # If user is client, override client_id filter
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        client_id = client.id
        if include_deleted or deleted_only:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clients cannot access deleted transactions",
            )

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
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or transaction.client_id != client.id:
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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can update transactions",
        )

    service = TransactionService(db)
    repo = TransactionRepository(db)
    before_transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not before_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
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
            status_code=status.HTTP_404_NOT_FOUND,
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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can mark transactions as paid",
        )

    service = TransactionService(db)

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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can delete transactions",
        )

    service = TransactionService(db)
    repo = TransactionRepository(db)
    transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not transaction or transaction.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    transaction_snapshot = _transaction_snapshot(transaction)

    deleted = await service.delete_transaction(transaction_id)

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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can restore transactions",
        )

    service = TransactionService(db)
    repo = TransactionRepository(db)
    deleted_transaction = await repo.get_by_id_with_relations(transaction_id, include_deleted=True)
    if not deleted_transaction or deleted_transaction.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted transaction not found",
        )
    restored = await service.restore_transaction(transaction_id)

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
            generated_by_id=current_user.id,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/fees/preview", response_model=dict)
async def preview_monthly_fees(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    reference_month: date = Query(...),
    client_id: Optional[UUID] = Query(None),
):
    """
    Preview monthly fees generation without creating them.

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can preview fees",
        )

    service = FeeGeneratorService(db)

    try:
        result = await service.get_generation_preview(
            reference_month=reference_month,
            client_id=client_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
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
