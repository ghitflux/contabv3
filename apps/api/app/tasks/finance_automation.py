"""
Finance automation background tasks.

- Generates monthly honorários (fees) on day 01
- Marks overdue receivables and keeps Client.status in sync
"""

from __future__ import annotations

import logging
import re
from calendar import monthrange
from datetime import date
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import db_manager
from app.db.models.client import Client, ClientStatus
from app.db.models.finance import FinancialTransaction, PaymentStatus, TransactionType
from app.db.models.user import User, UserRole

logger = logging.getLogger(__name__)

_CLIENT_ID_IN_NOTES_RE = re.compile(
    r"Cliente:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
    re.IGNORECASE,
)

def _get_first_day_of_next_month(reference_date: date) -> date:
    """Return the first day of the month after reference_date."""
    if reference_date.month == 12:
        return date(reference_date.year + 1, 1, 1)
    return date(reference_date.year, reference_date.month + 1, 1)


def _resolve_due_date_for_client(reference_month: date, due_day: int | None) -> date:
    """Resolve due date in reference month from client due day with clamping."""
    safe_due_day = due_day if isinstance(due_day, int) else 1
    safe_due_day = max(1, min(31, safe_due_day))
    last_day = monthrange(reference_month.year, reference_month.month)[1]
    return reference_month.replace(day=min(safe_due_day, last_day))


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
    Generate honorários transactions for all eligible clients for a given month.

    Creates:
    - Client ledger: DESPESA (accounts payable) entry
    - Office ledger (if configured): RECEITA (accounts receivable) entry
    """
    if reference_month.day != 1:
        reference_month = reference_month.replace(day=1)

    # Honorários use next-month reference, with due date based on each client profile.
    reference_month = _get_first_day_of_next_month(reference_month)
    office_client_id = settings.OFFICE_CLIENT_ID
    reference_label = reference_month.strftime("%m/%Y")

    stmt = (
        select(Client)
        .where(
            Client.deleted_at.is_(None),
            Client.status != ClientStatus.INATIVO,
            Client.gerar_lancamentos_honorarios.is_(True),
        )
        .order_by(Client.razao_social)
    )
    result = await session.execute(stmt)
    clients = result.scalars().all()

    total_clients = len(clients)
    created_client_entries = 0
    created_office_entries = 0
    skipped = 0
    errors = 0

    for client in clients:
        try:
            if not client.honorarios_mensais or float(client.honorarios_mensais) <= 0:
                skipped += 1
                continue

            due_date = _resolve_due_date_for_client(reference_month, client.dia_vencimento)

            # Client: accounts payable (expense)
            client_description = f"Honorários do escritório - {reference_label}"
            existing_client_tx = await session.scalar(
                select(FinancialTransaction.id)
                .where(
                    FinancialTransaction.client_id == client.id,
                    FinancialTransaction.reference_month == reference_month,
                    FinancialTransaction.transaction_type == TransactionType.DESPESA,
                    FinancialTransaction.description == client_description,
                    FinancialTransaction.deleted_at.is_(None),
                )
                .limit(1)
            )
            if not existing_client_tx:
                session.add(
                    FinancialTransaction(
                        client_id=client.id,
                        obligation_id=None,
                        transaction_type=TransactionType.DESPESA,
                        amount=client.honorarios_mensais,
                        payment_method=None,
                        payment_status=PaymentStatus.PENDENTE,
                        due_date=due_date,
                        paid_date=None,
                        reference_month=reference_month,
                        description=client_description,
                        category=None,
                        notes=f"Gerado automaticamente em {date.today().strftime('%d/%m/%Y')} (honorários recorrentes).",
                        invoice_number=None,
                        created_by_id=created_by_id,
                    )
                )
                created_client_entries += 1

            # Office: accounts receivable (revenue)
            if office_client_id:
                office_description = f"Honorários - {client.razao_social} ({client.cnpj}) - {reference_label}"
                existing_office_tx = await session.scalar(
                    select(FinancialTransaction.id)
                    .where(
                        FinancialTransaction.client_id == office_client_id,
                        FinancialTransaction.reference_month == reference_month,
                        FinancialTransaction.transaction_type == TransactionType.RECEITA,
                        FinancialTransaction.description == office_description,
                        FinancialTransaction.deleted_at.is_(None),
                    )
                    .limit(1)
                )
                if not existing_office_tx:
                    session.add(
                        FinancialTransaction(
                            client_id=office_client_id,
                            obligation_id=None,
                            transaction_type=TransactionType.RECEITA,
                            amount=client.honorarios_mensais,
                            payment_method=None,
                            payment_status=PaymentStatus.PENDENTE,
                            due_date=due_date,
                            paid_date=None,
                            reference_month=reference_month,
                            description=office_description,
                            category=None,
                            notes=(
                                f"Gerado automaticamente em {date.today().strftime('%d/%m/%Y')} (honorários recorrentes). "
                                f"Cliente: {client.id}"
                            ),
                            invoice_number=None,
                            created_by_id=created_by_id,
                        )
                    )
                    created_office_entries += 1
        except Exception as e:
            logger.error(f"Error generating honorários for client {client.id}: {e}", exc_info=True)
            errors += 1

    return {
        "success": True,
        "reference_month": reference_month.isoformat(),
        "total_clients": total_clients,
        "created_client_entries": created_client_entries,
        "created_office_entries": created_office_entries,
        "skipped": skipped,
        "errors": errors,
    }


async def sync_clients_pending_status(session: AsyncSession, *, today: date | None = None) -> dict:
    """
    Sync Client.status based on overdue honorários without baixa (unpaid).

    Rules:
    - If there is an overdue office RECEITA honorários transaction for a client, mark as PENDENTE
    - If client is PENDENTE but has no overdue honorários, mark as ATIVO
    - INATIVO clients are not changed
    """
    if today is None:
        today = date.today()

    office_client_id = settings.OFFICE_CLIENT_ID
    if not office_client_id:
        logger.warning("OFFICE_CLIENT_ID not configured; skipping client pending sync")
        return {"success": True, "pending_clients": 0, "activated_clients": 0, "mode": "skipped"}

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

    pending_count = 0
    activated_count = 0

    if overdue_client_ids:
        res = await session.execute(
            update(Client)
            .where(
                Client.id.in_(overdue_client_ids),
                Client.deleted_at.is_(None),
                Client.status != ClientStatus.INATIVO,
                Client.gerar_lancamentos_honorarios.is_(True),
            )
            .values(status=ClientStatus.PENDENTE)
        )
        pending_count = int(res.rowcount or 0)

    res = await session.execute(
        update(Client)
        .where(
            Client.deleted_at.is_(None),
            Client.status == ClientStatus.PENDENTE,
            Client.status != ClientStatus.INATIVO,
            Client.gerar_lancamentos_honorarios.is_(True),
            Client.id.notin_(overdue_client_ids) if overdue_client_ids else True,
        )
        .values(status=ClientStatus.ATIVO)
    )
    activated_count = int(res.rowcount or 0)

    return {
        "success": True,
        "pending_clients": pending_count,
        "activated_clients": activated_count,
        "overdue_honorarios": len(overdue_client_ids),
        "mode": "office",
    }


async def run_finance_daily_automation() -> dict:
    """
    Entry point for scheduled finance automation.
    Runs daily:
    - Marks overdue receivables
    - Syncs Client.status (pendente/ativo)
    - Generates next month's honorários on day 01
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

        # 3) Generate next month's honorários only on day 01
        generation_summary = None
        if today.day == 1:
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
