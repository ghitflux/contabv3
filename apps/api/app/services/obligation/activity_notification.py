"""Obligation activity + reminder notification helpers."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.activity import Activity, ActivityPriority, ActivityStatus
from app.db.models.client import Client
from app.db.models.notification import Notification
from app.db.models.obligation import Obligation, ObligationStatus
from app.db.models.obligation_event import ObligationEvent, ObligationEventType
from app.db.models.user import User, UserRole
from app.schemas.notification import NotificationType
from app.websockets.handlers import ws_handler

logger = logging.getLogger(__name__)

_OBLIGATION_LABEL_PREFIX = "obligation:"


def _activity_priority_from_obligation(priority: object) -> ActivityPriority:
    value = getattr(priority, "value", str(priority)).lower()
    if value in {"urgente", "alta"}:
        return ActivityPriority.HIGH
    if value == "baixa":
        return ActivityPriority.LOW
    return ActivityPriority.MEDIUM


def _activity_status_from_obligation(status: object) -> ActivityStatus:
    value = getattr(status, "value", str(status)).lower()
    if value == ObligationStatus.EM_ANDAMENTO.value:
        return ActivityStatus.IN_PROGRESS
    if value in {ObligationStatus.CONCLUIDA.value, ObligationStatus.CANCELADA.value}:
        return ActivityStatus.DONE
    return ActivityStatus.TODO


def _build_activity_title(obligation: Obligation) -> str:
    client_name = ""
    if obligation.client:
        client_name = obligation.client.nome_fantasia or obligation.client.razao_social or ""
    ob_name = (
        obligation.obligation_type.name
        if obligation.obligation_type
        else "Obrigacao"
    )
    raw = f"Obrigacao: {ob_name} - {client_name}".strip(" -")
    return raw[:200]


def _build_activity_description(obligation: Obligation) -> str:
    due_label = obligation.due_date.strftime("%d/%m/%Y") if obligation.due_date else "sem vencimento"
    client_name = ""
    client_cnpj = ""
    if obligation.client:
        client_name = obligation.client.razao_social or ""
        client_cnpj = obligation.client.cnpj or ""

    details = [
        f"Obrigacao vinculada ao modulo Obrigacoes.",
        f"Cliente: {client_name} ({client_cnpj})".strip(),
        f"Vencimento: {due_label}",
    ]
    if obligation.description:
        details.append(f"Referencia: {obligation.description}")
    return "\n".join(details)


def _build_activity_labels(obligation: Obligation) -> str:
    labels = [
        "obrigacoes",
        f"{_OBLIGATION_LABEL_PREFIX}{obligation.id}",
        f"client:{obligation.client_id}",
    ]
    return ",".join(labels)


def _extract_obligation_id_from_labels(labels: Optional[str]) -> Optional[UUID]:
    if not labels:
        return None
    for item in labels.split(","):
        token = item.strip()
        if not token.startswith(_OBLIGATION_LABEL_PREFIX):
            continue
        raw_id = token[len(_OBLIGATION_LABEL_PREFIX):]
        try:
            return UUID(raw_id)
        except ValueError:
            return None
    return None


async def _resolve_default_office_user_id(db: AsyncSession) -> Optional[UUID]:
    admin_id = await db.scalar(
        select(User.id)
        .where(and_(User.is_active.is_(True), User.role == UserRole.ADMIN))
        .limit(1)
    )
    if admin_id:
        return admin_id

    func_id = await db.scalar(
        select(User.id)
        .where(and_(User.is_active.is_(True), User.role == UserRole.FUNC))
        .limit(1)
    )
    return func_id


async def _resolve_client_user_id(db: AsyncSession, client: Optional[Client]) -> Optional[UUID]:
    if not client:
        return None
    if client.user_id:
        return client.user_id
    if not client.email:
        return None

    user_id = await db.scalar(
        select(User.id)
        .where(
            and_(
                User.email == client.email,
                User.role == UserRole.CLIENTE,
                User.is_active.is_(True),
            )
        )
        .limit(1)
    )
    return user_id


async def resolve_obligation_creator_user_id(
    db: AsyncSession,
    obligation_id: UUID,
) -> Optional[UUID]:
    return await db.scalar(
        select(ObligationEvent.user_id)
        .join(User, User.id == ObligationEvent.user_id)
        .where(
            ObligationEvent.obligation_id == obligation_id,
            ObligationEvent.event_type == ObligationEventType.CREATED,
            ObligationEvent.user_id.is_not(None),
            User.role.in_([UserRole.ADMIN, UserRole.FUNC]),
            User.is_active.is_(True),
        )
        .order_by(ObligationEvent.created_at.asc())
        .limit(1)
    )


async def _resolve_activity_assignee(
    db: AsyncSession,
    obligation: Obligation,
    preferred_user_id: Optional[UUID] = None,
) -> Optional[UUID]:
    client_user_id = await _resolve_client_user_id(db, obligation.client)
    if client_user_id:
        return client_user_id

    creator_user_id = await resolve_obligation_creator_user_id(db, obligation.id)
    if creator_user_id:
        return creator_user_id

    if preferred_user_id:
        return preferred_user_id

    return await _resolve_default_office_user_id(db)


async def _find_activity_by_obligation_id(
    db: AsyncSession,
    obligation_id: UUID,
) -> Optional[Activity]:
    result = await db.execute(
        select(Activity)
        .where(
            Activity.deleted_at.is_(None),
            Activity.labels.is_not(None),
            Activity.labels.ilike(f"%{_OBLIGATION_LABEL_PREFIX}{obligation_id}%"),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def upsert_obligation_activity(
    db: AsyncSession,
    obligation: Obligation,
    *,
    preferred_user_id: Optional[UUID] = None,
    existing_activity: Optional[Activity] = None,
) -> bool:
    """
    Create/update the activity linked to an obligation.

    Returns True when a row was created/updated.
    """
    if obligation.deleted_at is not None:
        return False

    assignee_id = await _resolve_activity_assignee(
        db,
        obligation,
        preferred_user_id=preferred_user_id,
    )
    if not assignee_id:
        return False

    if existing_activity is None:
        existing_activity = await _find_activity_by_obligation_id(db, obligation.id)

    target_title = _build_activity_title(obligation)
    target_description = _build_activity_description(obligation)
    target_status = _activity_status_from_obligation(obligation.status)
    target_priority = _activity_priority_from_obligation(obligation.priority)
    target_labels = _build_activity_labels(obligation)

    if not existing_activity:
        created_by_id = (
            await resolve_obligation_creator_user_id(db, obligation.id)
            or preferred_user_id
            or assignee_id
        )
        activity = Activity(
            title=target_title,
            description=target_description,
            status=target_status,
            priority=target_priority,
            assigned_to_id=assignee_id,
            due_date=obligation.due_date,
            labels=target_labels,
            recurrence=None,
            reminders=True,
            created_by_id=created_by_id,
        )
        db.add(activity)
        await db.flush()
        return True

    changed = False

    if existing_activity.title != target_title:
        existing_activity.title = target_title
        changed = True
    if existing_activity.description != target_description:
        existing_activity.description = target_description
        changed = True
    if existing_activity.status != target_status:
        existing_activity.status = target_status
        changed = True
    if existing_activity.priority != target_priority:
        existing_activity.priority = target_priority
        changed = True
    if existing_activity.assigned_to_id != assignee_id:
        existing_activity.assigned_to_id = assignee_id
        changed = True
    if existing_activity.due_date != obligation.due_date:
        existing_activity.due_date = obligation.due_date
        changed = True
    if existing_activity.labels != target_labels:
        existing_activity.labels = target_labels
        changed = True
    if not existing_activity.reminders:
        existing_activity.reminders = True
        changed = True

    if changed:
        await db.flush()

    return changed


async def sync_all_existing_obligation_activities(
    db: AsyncSession,
    *,
    preferred_user_id: Optional[UUID] = None,
) -> dict:
    """Backfill/sync activities for all non-deleted obligations."""
    obligations_result = await db.execute(
        select(Obligation)
        .options(
            selectinload(Obligation.client),
            selectinload(Obligation.obligation_type),
        )
        .where(Obligation.deleted_at.is_(None))
        .order_by(Obligation.created_at.asc())
    )
    obligations = obligations_result.scalars().all()

    activities_result = await db.execute(
        select(Activity).where(
            Activity.deleted_at.is_(None),
            Activity.labels.is_not(None),
            Activity.labels.ilike(f"%{_OBLIGATION_LABEL_PREFIX}%"),
        )
    )
    existing_activities = activities_result.scalars().all()

    activity_map: dict[UUID, Activity] = {}
    for activity in existing_activities:
        obligation_id = _extract_obligation_id_from_labels(activity.labels)
        if obligation_id:
            activity_map[obligation_id] = activity

    created = 0
    updated = 0
    skipped = 0

    for obligation in obligations:
        existing_activity = activity_map.get(obligation.id)
        changed = await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=preferred_user_id,
            existing_activity=existing_activity,
        )

        if existing_activity:
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            if changed:
                created += 1
            else:
                skipped += 1

    return {
        "total_obligations": len(obligations),
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }


async def _has_due_soon_reminder_event(
    db: AsyncSession,
    obligation_id: UUID,
    *,
    due_date: date,
    reminder_days: int,
) -> bool:
    result = await db.execute(
        select(ObligationEvent.extra_data)
        .where(
            ObligationEvent.obligation_id == obligation_id,
            ObligationEvent.event_type == ObligationEventType.REMINDER_SENT,
        )
        .order_by(ObligationEvent.created_at.desc())
        .limit(30)
    )
    for (extra_data,) in result.all():
        if not isinstance(extra_data, dict):
            continue
        if extra_data.get("due_date") != due_date.isoformat():
            continue
        if int(extra_data.get("reminder_days", 0)) != reminder_days:
            continue
        return True
    return False


async def _create_and_dispatch_notification(
    db: AsyncSession,
    notification: Notification,
) -> None:
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    await ws_handler.handle_new_notification(notification)


async def send_due_soon_notifications_for_obligation(
    db: AsyncSession,
    obligation: Obligation,
    *,
    reminder_days: int = 5,
    reference_date: Optional[date] = None,
) -> int:
    """Send due-soon notifications for one obligation when due in N days."""
    if obligation.deleted_at is not None:
        return 0

    if obligation.status in {ObligationStatus.CONCLUIDA, ObligationStatus.CANCELADA}:
        return 0

    today = reference_date or date.today()
    target_due_date = today + timedelta(days=reminder_days)
    if obligation.due_date != target_due_date:
        return 0

    already_sent = await _has_due_soon_reminder_event(
        db,
        obligation.id,
        due_date=target_due_date,
        reminder_days=reminder_days,
    )
    if already_sent:
        return 0

    recipient_ids: set[UUID] = set()

    client_user_id = await _resolve_client_user_id(db, obligation.client)
    if client_user_id:
        recipient_ids.add(client_user_id)

    creator_user_id = await resolve_obligation_creator_user_id(db, obligation.id)
    if creator_user_id:
        recipient_ids.add(creator_user_id)

    due_label = obligation.due_date.strftime("%d/%m/%Y") if obligation.due_date else "-"
    ob_name = obligation.obligation_type.name if obligation.obligation_type else "Obrigacao"
    client_name = ""
    if obligation.client:
        client_name = obligation.client.nome_fantasia or obligation.client.razao_social or ""

    title = f"Obrigacao vence em {reminder_days} dias"
    message = f"{ob_name} de {client_name} vence em {due_label}."

    extra_data = {
        "obligation_id": str(obligation.id),
        "client_id": str(obligation.client_id),
        "client_name": client_name,
        "obligation_type": getattr(obligation.obligation_type, "code", None),
        "due_date": obligation.due_date.isoformat() if obligation.due_date else None,
        "reminder_days": reminder_days,
    }

    sent_count = 0
    for user_id in recipient_ids:
        notification = Notification.create_notification(
            user_id=user_id,
            notification_type=NotificationType.OBLIGATION_DUE_SOON,
            title=title,
            message=message,
            link=f"/obrigacoes?id={obligation.id}",
            extra_data=extra_data,
        )
        await _create_and_dispatch_notification(db, notification)
        sent_count += 1

    reminder_event = ObligationEvent(
        obligation_id=obligation.id,
        event_type=ObligationEventType.REMINDER_SENT,
        description=f"Due soon reminder sent ({reminder_days} days before due date)",
        user_id=None,
        extra_data={
            "due_date": obligation.due_date.isoformat() if obligation.due_date else None,
            "reminder_days": reminder_days,
            "recipients": [str(user_id) for user_id in recipient_ids],
            "sent_count": sent_count,
        },
    )
    db.add(reminder_event)
    await db.flush()

    return sent_count


async def send_due_soon_notifications_for_date(
    db: AsyncSession,
    *,
    reminder_days: int = 5,
    reference_date: Optional[date] = None,
) -> dict:
    """Send due-soon reminders for all obligations due in N days."""
    today = reference_date or date.today()
    target_due_date = today + timedelta(days=reminder_days)

    result = await db.execute(
        select(Obligation)
        .options(
            selectinload(Obligation.client),
            selectinload(Obligation.obligation_type),
        )
        .where(
            Obligation.deleted_at.is_(None),
            Obligation.due_date == target_due_date,
            Obligation.status.in_(
                [
                    ObligationStatus.PENDENTE,
                    ObligationStatus.EM_ANDAMENTO,
                    ObligationStatus.ATRASADA,
                ]
            ),
        )
    )
    obligations = result.scalars().all()

    sent_total = 0
    for obligation in obligations:
        sent_total += await send_due_soon_notifications_for_obligation(
            db,
            obligation,
            reminder_days=reminder_days,
            reference_date=today,
        )

    return {
        "checked_obligations": len(obligations),
        "notifications_sent": sent_total,
        "target_due_date": target_due_date.isoformat(),
        "reminder_days": reminder_days,
    }


async def sync_obligation_activities_for_list(
    db: AsyncSession,
    obligations: Iterable[Obligation],
    *,
    preferred_user_id: Optional[UUID] = None,
) -> int:
    """Sync activities for a provided obligation collection."""
    updated = 0
    for obligation in obligations:
        changed = await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=preferred_user_id,
        )
        if changed:
            updated += 1
    return updated
