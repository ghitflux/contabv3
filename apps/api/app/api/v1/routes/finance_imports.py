"""Bank statement import routes."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.audit import AuditLog
from app.db.models.bank_account import BankAccount
from app.db.models.finance import StatementImport, StatementImportRow
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.schemas.finance import (
    StatementImportCommitRequest,
    StatementImportCommitResponse,
    StatementImportPreviewResponse,
    StatementImportRowResponse,
)
from app.services.finance import StatementImportService

router = APIRouter(prefix="/finance/imports", tags=["finance"])

ALLOWED_STATEMENT_IMPORT_EXTENSIONS = {".pdf", ".ofx", ".csv"}
ALLOWED_STATEMENT_IMPORT_CONTENT_TYPES = (
    "pdf",
    "ofx",
    "csv",
    "comma-separated-values",
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


async def _get_accessible_bank_account(
    db: AsyncSession,
    current_user: User,
    bank_account_id: UUID,
) -> BankAccount:
    bank_account = await db.get(BankAccount, bank_account_id)
    if bank_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if bank_account.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to import into this bank account",
            )

    return bank_account


async def _get_accessible_import(
    db: AsyncSession,
    current_user: User,
    import_id: UUID,
) -> StatementImport:
    service = StatementImportService(db)
    try:
        statement_import = await service.get_import(import_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if current_user.role == UserRole.CLIENTE:
        client = await _get_client_profile(db, current_user)
        if statement_import.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this statement import",
            )

    return statement_import


def _serialize_import(statement_import: StatementImport) -> StatementImportPreviewResponse:
    rows = sorted(statement_import.rows, key=lambda row: (row.line_number, row.created_at))
    total_income = sum(
        (row.amount_signed for row in rows if row.amount_signed > 0),
        Decimal("0.00"),
    )
    total_expense = sum(
        (abs(row.amount_signed) for row in rows if row.amount_signed < 0),
        Decimal("0.00"),
    )

    return StatementImportPreviewResponse(
        import_id=statement_import.id,
        client_id=statement_import.client_id,
        bank_account_id=statement_import.bank_account_id,
        source_format=statement_import.source_format,
        status=statement_import.status.value,
        original_filename=statement_import.original_filename,
        detected_bank_name=statement_import.detected_bank_name,
        detected_account_number=statement_import.detected_account_number,
        period_start=statement_import.period_start,
        period_end=statement_import.period_end,
        opening_balance=statement_import.opening_balance,
        closing_balance=statement_import.closing_balance,
        total_rows=statement_import.total_rows,
        duplicate_rows=statement_import.duplicate_rows,
        imported_rows=statement_import.imported_rows,
        total_income=total_income,
        total_expense=total_expense,
        rows=[StatementImportRowResponse.model_validate(row) for row in rows],
    )


@router.post("/preview", response_model=StatementImportPreviewResponse, status_code=status.HTTP_201_CREATED)
async def preview_statement_import(
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    bank_account_id: UUID = Form(...),
    file: UploadFile = File(...),
) -> StatementImportPreviewResponse:
    extension = (file.filename or "").lower().rsplit(".", 1)
    suffix = f".{extension[-1]}" if len(extension) > 1 else ""
    normalized_content_type = (file.content_type or "").lower()
    has_supported_content_type = any(
        marker in normalized_content_type for marker in ALLOWED_STATEMENT_IMPORT_CONTENT_TYPES
    )
    if suffix and suffix not in ALLOWED_STATEMENT_IMPORT_EXTENSIONS and not has_supported_content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Use PDF, OFX ou CSV.",
        )

    bank_account = await _get_accessible_bank_account(db, current_user, bank_account_id)
    payload = await file.read()
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo vazio.",
        )

    service = StatementImportService(db)
    try:
        statement_import = await service.preview_import(
            bank_account=bank_account,
            created_by_id=current_user.id,
            filename=file.filename or f"extrato{suffix}",
            content_type=file.content_type,
            file_bytes=payload,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="statement_import.preview",
            entity="statement_import",
            entity_id=str(statement_import.id),
            payload={
                "summary": (
                    f"Prévia de importação gerada com {statement_import.total_rows} linha(s) "
                    f"e {statement_import.duplicate_rows} possível(is) duplicado(s)."
                ),
                "bank_account_id": str(statement_import.bank_account_id),
                "client_id": str(statement_import.client_id),
                "format": statement_import.source_format.value,
                "filename": statement_import.original_filename,
                "total_rows": statement_import.total_rows,
                "duplicate_rows": statement_import.duplicate_rows,
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()
    return _serialize_import(statement_import)


@router.get("/{import_id}", response_model=StatementImportPreviewResponse)
async def get_statement_import(
    import_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> StatementImportPreviewResponse:
    statement_import = await _get_accessible_import(db, current_user, import_id)
    return _serialize_import(statement_import)


@router.post("/{import_id}/commit", response_model=StatementImportCommitResponse)
async def commit_statement_import(
    import_id: UUID,
    payload: StatementImportCommitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> StatementImportCommitResponse:
    statement_import = await _get_accessible_import(db, current_user, import_id)
    service = StatementImportService(db)

    row_ids = {row.id for row in statement_import.rows}
    rows_payload = {}
    for row in payload.rows:
        if row.row_id not in row_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uma ou mais linhas não pertencem a esta importação.",
            )
        rows_payload[row.row_id] = (row.is_selected, row.category, row.notes)

    try:
        statement_import, transactions, skipped_count, duplicate_skipped_count = (
            await service.commit_import(
                import_id=import_id,
                rows_payload=rows_payload,
                committed_by_id=current_user.id,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="statement_import.commit",
            entity="statement_import",
            entity_id=str(statement_import.id),
            payload={
                "summary": (
                    f"Importação confirmada: {len(transactions)} lançamento(s) criado(s), "
                    f"{skipped_count} linha(s) ignorada(s)."
                ),
                "client_id": str(statement_import.client_id),
                "bank_account_id": str(statement_import.bank_account_id),
                "imported_count": len(transactions),
                "skipped_count": skipped_count,
                "duplicate_skipped_count": duplicate_skipped_count,
                "transaction_ids": [str(transaction.id) for transaction in transactions],
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.commit()

    return StatementImportCommitResponse(
        import_id=statement_import.id,
        imported_count=len(transactions),
        skipped_count=skipped_count,
        duplicate_skipped_count=duplicate_skipped_count,
        transaction_ids=[transaction.id for transaction in transactions],
    )
