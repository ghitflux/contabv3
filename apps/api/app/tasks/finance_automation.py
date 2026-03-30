"""
Finance automation background tasks.

- Generates missing monthly honorários up to the current month
- Marks overdue receivables and keeps Client.status in sync
"""

from __future__ import annotations

import logging
import re
from datetime import date
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import db_manager
from app.db.models.client import Client, ClientStatus
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.models.user import User, UserRole
from app.services.finance.fee_generator_service import FeeGeneratorService

logger = logging.getLogger(__name__)

_CLIENT_ID_IN_NOTES_RE = re.compile(
    r"Cliente:\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
    re.IGNORECASE,
)


async def _resolve_system_user_id(session: AsyncSession) -> UUID:
    """
    Choose an existing active user to attribute automated transactions to.
    Prefers ADMIN, falls back to FUNC.
    """
    admin_id = await session.scalar(
        select(User.id)
        .where(and_(User.is_active.is_(True), User.role == UserRole.ADMIN))
        .limit(1)
    )
    if admin_id:
        return admin_id

    func_id = await session.scalar(
        select(User.id)
        .where(and_(User.is_active.is_(True), User.role == UserRole.FUNC))
        .limit(1)
    )
    if func_id:
        return func_id

    raise RuntimeError("No active ADMIN/FUNC user found for finance automation (created_by_id)")


async def generate_monthly_honorarios(
    session: AsyncSession,
    *,
    reference_month: date,
    created_by_id: UUID,
) -> dict:
    """
    Generate missing honorários transactions through the given month.
    """
    service = FeeGeneratorService(session)
    return await service.generate_missing_monthly_fees(
        reference_month=reference_month,
        generated_by_id=created_by_id,
    )


async def sync_clients_pending_status(session: AsyncSession, *, today: date | None = None) -> dict:
    """
    Sync Client.status based on overdue honorários without baixa (unpaid).

    Rules:
    - If there is an overdue office RECEITA honorários transaction for a client, mark as INADIMPLENTE
    - If client is INADIMPLENTE but has no overdue honorários, mark as ATIVO
    - INATIVO clients are not changed
    """
    if today is None:
        today = date.today()

    office_client_id = settings.OFFICE_CLIENT_ID
    if not office_client_id:
        logger.warning("OFFICE_CLIENT_ID not configured; skipping client pending sync")
        return {
            "success": True,
            "inadimplente_clients": 0,
            "activated_clients": 0,
            "mode": "skipped",
        }

    overdue_notes = await session.execute(
        select(FinancialTransaction.notes)
        .where(
            FinancialTransaction.client_id == office_client_id,
            FinancialTransaction.transaction_type == TransactionType.RECEITA,
            FinancialTransaction.payment_status.in_(
                [PaymentStatus.PENDENTE, PaymentStatus.ATRASADO, PaymentStatus.PARCIAL]
            ),
            FinancialTransaction.due_date < today,
            FinancialTransaction.deleted_at.is_(None),
            FinancialTransaction.notes.is_not(None),
            FinancialTransaction.description.ilike("Honorários -%"),
        )
    )

    overdue_client_ids: set[UUID] = set()
    for (notes,) in overdue_notes.all():
        if not notes:
            continue
        match = _CLIENT_ID_IN_NOTES_RE.search(notes)
        if not match:
            continue
        try:
            overdue_client_ids.add(UUID(match.group(1)))
        except ValueError:
            continue

    inadimplente_count = 0
    activated_count = 0

    if overdue_client_ids:
        res = await session.execute(
            update(Client)
            .where(
                Client.id.in_(overdue_client_ids),
                Client.deleted_at.is_(None),
                Client.status != ClientStatus.INATIVO,
                Client.gerar_lancamentos_honorarios.is_(True),
                Client.honorarios_mensais > 0,
            )
            .values(status=ClientStatus.INADIMPLENTE)
        )
        inadimplente_count = int(res.rowcount or 0)

    res = await session.execute(
        update(Client)
        .where(
            Client.deleted_at.is_(None),
            Client.status == ClientStatus.INADIMPLENTE,
            Client.status != ClientStatus.INATIVO,
            Client.gerar_lancamentos_honorarios.is_(True),
            Client.honorarios_mensais > 0,
            Client.id.notin_(overdue_client_ids) if overdue_client_ids else True,
        )
        .values(status=ClientStatus.ATIVO)
    )
    activated_count = int(res.rowcount or 0)

    return {
        "success": True,
        "inadimplente_clients": inadimplente_count,
        "activated_clients": activated_count,
        "overdue_honorarios": len(overdue_client_ids),
        "mode": "office",
    }


async def run_finance_daily_automation() -> dict:
    """
    Entry point for scheduled finance automation.
    Runs daily:
    - Marks overdue receivables
    - Syncs Client.status (inadimplente/ativo)
    - Completes missing honorários up to the current month
    """
    today = date.today()
    reference_month = today.replace(day=1)

    async with db_manager.session_factory() as session:
        system_user_id = await _resolve_system_user_id(session)

        # 1) Mark overdue transactions
        overdue_res = await session.execute(
            update(FinancialTransaction)
            .where(
                FinancialTransaction.payment_status == PaymentStatus.PENDENTE,
                FinancialTransaction.due_date < today,
                FinancialTransaction.deleted_at.is_(None),
            )
            .values(payment_status=PaymentStatus.ATRASADO)
        )
        overdue_updated = int(overdue_res.rowcount or 0)

        # 2) Sync client status based on overdue honorários
        sync_summary = await sync_clients_pending_status(session, today=today)

        # 3) Ensure current month honorários exist, backfilling missed months when needed
        generation_summary = await generate_monthly_honorarios(
            session,
            reference_month=reference_month,
            created_by_id=system_user_id,
        )

        await session.commit()

    return {
        "success": True,
        "date": today.isoformat(),
        "overdue_transactions_updated": overdue_updated,
        "client_status_sync": sync_summary,
        "monthly_generation": generation_summary,
    }


async def run_finance_automation_now() -> dict:
    """
    Manual trigger for finance automation (useful for admin endpoints/scripts).
    """
    logger.info("Manual finance automation run triggered")
    return await run_finance_daily_automation()
