"""
Audit log routes.
"""

from datetime import date, datetime, time, timezone
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_admin_or_func
from app.db.models.audit import AuditLog
from app.db.models.user import User
from app.schemas.audit import AuditLogListResponse, AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=AuditLogListResponse, status_code=status.HTTP_200_OK)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin_or_func()),
    client_id: Optional[UUID] = Query(None),
    user_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> AuditLogListResponse:
    """List audit logs with optional filters (admin/func only)."""
    conditions = []

    if user_id:
        conditions.append(AuditLog.user_id == user_id)
    if action:
        conditions.append(AuditLog.action == action)
    if entity:
        conditions.append(AuditLog.entity == entity)
    if client_id:
        conditions.append(AuditLog.payload["client_id"].astext == str(client_id))
    if start_date:
        start_dt = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
        conditions.append(AuditLog.created_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)
        conditions.append(AuditLog.created_at <= end_dt)

    count_stmt = select(func.count()).select_from(AuditLog)
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = await db.scalar(count_stmt) or 0

    stmt = (
        select(AuditLog, User)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    rows = result.all()

    items = []
    for audit, user in rows:
        items.append(
            AuditLogResponse(
                id=audit.id,
                user_id=audit.user_id,
                user_name=user.name if user else None,
                user_email=user.email if user else None,
                user_role=user.role.value if user and user.role else None,
                action=audit.action,
                entity=audit.entity,
                entity_id=audit.entity_id,
                payload=audit.payload,
                ip_address=audit.ip_address,
                user_agent=audit.user_agent,
                created_at=audit.created_at,
            )
        )

    return AuditLogListResponse(items=items, total=total, skip=skip, limit=limit)
