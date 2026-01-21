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


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    client_id: Optional[UUID] = Query(None),
    status: Optional[PaymentStatus] = Query(None),
    reference_month: Optional[date] = Query(None),
    due_date_from: Optional[date] = Query(None),
    due_date_to: Optional[date] = Query(None),
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

    transactions, total = await repo.list_with_filters(
        client_id=client_id,
        status=status,
        reference_month=reference_month,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
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
        if current_user.role == UserRole.CLIENTE:
            audit_log = AuditLog(
                user_id=current_user.id,
                action="transaction.create",
                entity="financial_transaction",
                entity_id=str(transaction.id),
                payload={
                    "client_id": str(transaction.client_id),
                    "summary": (
                        f"Lançamento criado: {transaction.description} - "
                        f"R$ {transaction.amount:.2f}"
                    ),
                    "description": transaction.description,
                    "amount": f"{transaction.amount:.2f}",
                    "transaction_type": transaction.transaction_type.value,
                    "payment_status": transaction.payment_status.value,
                    "payment_method": transaction.payment_method.value if transaction.payment_method else None,
                    "due_date": str(transaction.due_date),
                    "reference_month": str(transaction.reference_month),
                },
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

    try:
        transaction = await service.update_transaction(
            transaction_id=transaction_id,
            data=data,
        )
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
    deleted = await service.delete_transaction(transaction_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    await db.commit()
    return None


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
