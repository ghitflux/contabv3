"""Obligations API routes."""

from datetime import date, datetime
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_active_user, get_db
from app.core.config import settings
from app.db.models.obligation_event import ObligationEvent, ObligationEventType
from app.db.models.user import User, UserRole
from app.db.models.obligation import Obligation, ObligationStatus
from app.db.models.obligation_type import ObligationType
from app.db.repositories.obligation import ObligationRepository
from app.db.repositories.obligation_event import ObligationEventRepository
from app.db.repositories.client import ClientRepository
from app.schemas.obligation import (
    ObligationCreate,
    ObligationResponse,
    ObligationListResponse,
    ObligationEventResponse,
    ObligationGenerateRequest,
    ObligationGenerateResponse,
    ObligationReceiptRequest,
    ObligationUpdate,
    ObligationUpdateDueDateRequest,
    ObligationCancelRequest,
)
from app.services.obligation.processor import ObligationProcessor
from app.services.obligation.generator import ObligationGenerator
from app.services.obligation.activity_notification import (
    send_due_soon_notifications_for_obligation,
    upsert_obligation_activity,
)
from app.websockets.manager import manager as websocket_manager

router = APIRouter()


async def _get_current_user_client(db: AsyncSession, current_user: User):
    client_repo = ClientRepository(db)
    client = await client_repo.get_by_user_id(current_user.id, current_user.email)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return client


async def _ensure_client_obligation_access(
    db: AsyncSession, current_user: User, obligation: Obligation
) -> None:
    if current_user.role != UserRole.CLIENTE:
        return
    client = await _get_current_user_client(db, current_user)
    if obligation.client_id != client.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this obligation",
        )


def _obligation_to_response(obligation) -> ObligationResponse:
    """Convert Obligation model to ObligationResponse schema."""
    ob_dict = {
        "id": obligation.id,
        "client_id": obligation.client_id,
        "client_name": obligation.client.razao_social if obligation.client else "",
        "client_cnpj": obligation.client.cnpj if obligation.client else "",
        "obligation_type_id": obligation.obligation_type_id,
        "obligation_type_name": obligation.obligation_type.name if obligation.obligation_type else "",
        "obligation_type_code": obligation.obligation_type.code if obligation.obligation_type else "",
        "due_date": obligation.due_date,
        "status": obligation.status,
        "priority": obligation.priority,
        "description": obligation.description,
        "receipt_url": obligation.receipt_url,
        "completed_at": obligation.completed_at,
        "completed_by_name": None,
        "created_at": obligation.created_at,
        "updated_at": obligation.updated_at,
        "deleted_at": obligation.deleted_at,
    }
    return ObligationResponse.model_validate(ob_dict)


@router.get("", response_model=ObligationListResponse)
async def list_obligations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    client_id: Optional[UUID] = Query(None),
    status: Optional[ObligationStatus] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    include_deleted: bool = Query(False, description="Include soft-deleted obligations"),
    deleted_only: bool = Query(False, description="Return only soft-deleted obligations"),
    category: Optional[str] = Query(None, description="Category: clients or office"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    List obligations with filters.

    - Admin/Func: Can see all obligations (client_id optional)
    - Client: Can only see their own obligations
    """
    if category and category not in {"clients", "office"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category. Use 'clients' or 'office'.",
        )

    if deleted_only:
        include_deleted = True

    repo = ObligationRepository(db)
    office_client_id = settings.OFFICE_CLIENT_ID

    # If user is client, override client_id filter
    if current_user.role == UserRole.CLIENTE:
        client = await _get_current_user_client(db, current_user)
        if category == "office":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clients cannot access office obligations",
            )
        client_id = client.id
    # Admin/Func can see all obligations if client_id is not provided

    obligations, total = await repo.list_with_filters(
        client_id=client_id,
        status=status,
        year=year,
        month=month,
        include_deleted=include_deleted,
        deleted_only=deleted_only,
        category=category,
        office_client_id=office_client_id,
        skip=skip,
        limit=limit,
    )

    # Convert to response format with client info
    items = [_obligation_to_response(ob) for ob in obligations]

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/alerts", response_model=dict)
async def get_obligation_alerts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: date = Query(..., description="Start date (inclusive)"),
    end_date: date = Query(..., description="End date (inclusive)"),
) -> dict:
    """
    Get pending obligations within a due date range (admin/func only).

    Used for dashboard/client-panel popups (e.g., due today / due in N days).
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can access obligation alerts",
        )

    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be greater than or equal to start_date",
        )

    stmt = (
        select(Obligation)
        .options(
            selectinload(Obligation.obligation_type),
            selectinload(Obligation.client),
        )
        .where(
            and_(
                Obligation.deleted_at.is_(None),
                Obligation.status == ObligationStatus.PENDENTE,
                Obligation.due_date >= start_date,
                Obligation.due_date <= end_date,
            )
        )
        .order_by(Obligation.due_date.asc())
    )

    result = await db.execute(stmt)
    obligations = result.scalars().all()

    items = [_obligation_to_response(ob) for ob in obligations]

    return {
        "items": items,
        "total": len(items),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }


@router.get("/types")
async def list_obligation_types(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
):
    """
    List all obligation types.
    Used for selecting which obligations to generate for each client.
    """
    from sqlalchemy import select
    from app.db.models.obligation_type import ObligationType
    from app.services.obligation.seed_types import ensure_obligation_types

    await ensure_obligation_types(db)
    query = select(ObligationType).order_by(ObligationType.name)

    if is_active is not None:
        query = query.where(ObligationType.is_active == is_active)

    result = await db.execute(query)
    obligation_types = result.scalars().all()

    return [
        {
            "id": str(ot.id),
            "name": ot.name,
            "code": ot.code,
            "description": ot.description,
            "applies_to_commerce": ot.applies_to_commerce,
            "applies_to_service": ot.applies_to_service,
            "applies_to_industry": ot.applies_to_industry,
            "applies_to_mei": ot.applies_to_mei,
            "applies_to_simples": ot.applies_to_simples,
            "applies_to_presumido": ot.applies_to_presumido,
            "applies_to_real": ot.applies_to_real,
            "recurrence": str(ot.recurrence.value if hasattr(ot.recurrence, 'value') else ot.recurrence),
            "day_of_month": ot.day_of_month,
            "month_of_year": ot.month_of_year,
            "is_active": ot.is_active,
        }
        for ot in obligation_types
    ]


@router.get("/matrix")
async def get_obligations_matrix(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    month: int = Query(..., ge=1, le=12, description="Month"),
    year: int = Query(..., ge=2020, le=2100, description="Year"),
    search: Optional[str] = Query(None, description="Search by company name, fantasy name or CNPJ"),
    starts_with: Optional[str] = Query(None, min_length=1, max_length=1, description="Initial letter"),
    due_date_from: Optional[date] = Query(None, description="Filter obligations with due_date >= this date"),
    due_date_to: Optional[date] = Query(None, description="Filter obligations with due_date <= this date"),
    category: str = Query("clients", description="Category: clients or office"),
):
    """
    Get obligations matrix (Companies x Obligation Types).

    Returns a matrix structure for the minimalist panel with:
    - List of clients
    - Each client's obligations for the specified month/year
    - Progress counter
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access obligations matrix",
        )

    if category not in {"clients", "office"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category. Use 'clients' or 'office'.",
        )

    if due_date_from and due_date_to and due_date_from > due_date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="due_date_from must be before or equal to due_date_to",
        )

    normalized_search = (search or "").strip()
    normalized_starts_with = (starts_with or "").strip().upper()
    reference_label = f"Referência: {month:02d}/{year}"

    from app.db.models.client import Client, ClientStatus

    clients = []
    if current_user.role == UserRole.CLIENTE:
        if category == "office":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clients cannot access office obligations",
            )
        client = await _get_current_user_client(db, current_user)
        clients = [client]

    office_client_id = settings.OFFICE_CLIENT_ID
    if not clients and category == "office":
        if not office_client_id:
            return []
        office_stmt = select(Client).where(Client.id == office_client_id)
        office_result = await db.execute(office_stmt)
        office_client = office_result.scalar_one_or_none()
        if not office_client:
            return []
        clients = [office_client]
    elif not clients:
        client_query = select(Client).where(Client.deleted_at.is_(None))

        if office_client_id:
            client_query = client_query.where(Client.id != office_client_id)

        if normalized_search:
            cnpj_digits = "".join(ch for ch in normalized_search if ch.isdigit())
            search_conditions = [
                Client.razao_social.ilike(f"%{normalized_search}%"),
                Client.nome_fantasia.ilike(f"%{normalized_search}%"),
                Client.cnpj.ilike(f"%{normalized_search}%"),
            ]
            if cnpj_digits:
                search_conditions.append(
                    func.regexp_replace(Client.cnpj, r"\D", "", "g").ilike(f"%{cnpj_digits}%")
                )
            client_query = client_query.where(or_(*search_conditions))

        if normalized_starts_with:
            client_query = client_query.where(
                or_(
                    func.upper(func.left(Client.razao_social, 1)) == normalized_starts_with,
                    func.upper(func.left(func.coalesce(Client.nome_fantasia, ""), 1)) == normalized_starts_with,
                )
            )

        client_query = client_query.order_by(Client.razao_social)
        clients_result = await db.execute(client_query)
        clients = clients_result.scalars().all()

    if not clients:
        return []

    client_ids = [client.id for client in clients]
    obligations_query = (
        select(Obligation)
        .options(selectinload(Obligation.obligation_type))
        .where(
            Obligation.client_id.in_(client_ids),
            Obligation.deleted_at.is_(None),
            or_(
                Obligation.description == reference_label,
                and_(
                    func.extract("month", Obligation.due_date) == month,
                    func.extract("year", Obligation.due_date) == year,
                ),
            ),
        )
        .order_by(Obligation.due_date.asc())
    )

    if due_date_from:
        obligations_query = obligations_query.where(Obligation.due_date >= due_date_from)
    if due_date_to:
        obligations_query = obligations_query.where(Obligation.due_date <= due_date_to)

    obligations_result = await db.execute(obligations_query)
    obligations = obligations_result.scalars().all()

    obligations_by_client: dict[UUID, list[dict]] = {}
    for ob in obligations:
        recurrence = None
        if ob.obligation_type and ob.obligation_type.recurrence is not None:
            recurrence = getattr(ob.obligation_type.recurrence, "value", ob.obligation_type.recurrence)

        obligation_data = {
            "id": str(ob.id),
            "status": str(ob.status.value if hasattr(ob.status, "value") else ob.status),
            "receipt_url": ob.receipt_url,
            "due_date": ob.due_date.isoformat() if ob.due_date else None,
            "obligation_type_name": ob.obligation_type.name if ob.obligation_type else "",
            "obligation_type_code": ob.obligation_type.code if ob.obligation_type else "",
            "recurrence": recurrence,
        }
        obligations_by_client.setdefault(ob.client_id, []).append(obligation_data)

    matrix = []
    for client in clients:
        obligations_list = obligations_by_client.get(client.id, [])
        completed = sum(1 for ob_data in obligations_list if ob_data["status"] == "concluida")
        total = len(obligations_list)

        display_name = client.nome_fantasia or client.razao_social or "Escritório"
        matrix.append(
            {
                "client_id": str(client.id),
                "client_name": display_name,
                "client_cnpj": client.cnpj,
                "client_regime_tributario": getattr(client.regime_tributario, "value", client.regime_tributario),
                "client_tipo_empresa": getattr(client.tipo_empresa, "value", client.tipo_empresa),
                "obligations": obligations_list,
                "completed": completed,
                "total": total,
            }
        )

    return matrix


@router.get("/{obligation_id}", response_model=ObligationResponse)
async def get_obligation(
    obligation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get obligation by ID."""
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)

    if not obligation or obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

    # Check access: clients can only see their own
    await _ensure_client_obligation_access(db, current_user, obligation)

    return _obligation_to_response(obligation)


@router.post("", response_model=ObligationResponse, status_code=status.HTTP_201_CREATED)
async def create_obligation(
    data: ObligationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Create an obligation.

    - Admin/Func: can create for any company (including office client)
    - Client: can create only for own company
    """
    repo = ObligationRepository(db)
    client_repo = ClientRepository(db)

    if current_user.role == UserRole.CLIENTE:
        client = await _get_current_user_client(db, current_user)
        data = data.model_copy(update={"client_id": client.id})
    elif current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create obligations",
        )

    client = await client_repo.get(data.client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    obligation_type = await db.scalar(
        select(ObligationType).where(ObligationType.id == data.obligation_type_id)
    )
    if not obligation_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation type not found",
        )

    duplicate = await db.scalar(
        select(Obligation).where(
            Obligation.client_id == data.client_id,
            Obligation.obligation_type_id == data.obligation_type_id,
            Obligation.due_date == data.due_date,
            Obligation.deleted_at.is_(None),
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An obligation with same type and due date already exists for this client",
        )

    obligation = Obligation(
        client_id=data.client_id,
        obligation_type_id=data.obligation_type_id,
        due_date=data.due_date,
        description=data.description,
        priority=data.priority,
        status=ObligationStatus.PENDENTE,
    )
    await repo.create(obligation)

    event_repo = ObligationEventRepository(db)
    await event_repo.create(
        ObligationEvent(
            obligation_id=obligation.id,
            event_type=ObligationEventType.CREATED,
            description="Obligation created manually",
            user_id=current_user.id,
            extra_data={
                "source": "manual",
                "due_date": data.due_date.isoformat(),
                "priority": data.priority.value if hasattr(data.priority, "value") else str(data.priority),
            },
        )
    )

    created_for_sync = await repo.get_by_id_with_relations(obligation.id, include_deleted=True)
    if created_for_sync:
        await upsert_obligation_activity(
            db,
            created_for_sync,
            preferred_user_id=current_user.id,
        )
        await send_due_soon_notifications_for_obligation(
            db,
            created_for_sync,
            reminder_days=5,
        )

    await db.commit()
    created = await repo.get_by_id_with_relations(obligation.id)
    if not created:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found after creation",
        )
    return _obligation_to_response(created)


@router.put("/{obligation_id}", response_model=ObligationResponse)
async def update_obligation(
    obligation_id: UUID,
    data: ObligationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Update an obligation.

    - Admin/Func: can update any obligation
    - Client: can update only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update obligations",
        )

    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if not obligation or obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

    await _ensure_client_obligation_access(db, current_user, obligation)

    before = {
        "status": obligation.status.value if hasattr(obligation.status, "value") else str(obligation.status),
        "priority": obligation.priority.value if hasattr(obligation.priority, "value") else str(obligation.priority),
        "description": obligation.description,
        "due_date": obligation.due_date.isoformat() if obligation.due_date else None,
    }

    if data.status is not None:
        obligation.status = data.status
        if data.status == ObligationStatus.CONCLUIDA and obligation.completed_at is None:
            obligation.completed_at = datetime.utcnow()
            obligation.completed_by = current_user.id
        if data.status != ObligationStatus.CONCLUIDA:
            obligation.completed_at = None
            obligation.completed_by = None
    if data.priority is not None:
        obligation.priority = data.priority
    if data.description is not None:
        obligation.description = data.description
    if data.due_date is not None:
        obligation.due_date = data.due_date

    await repo.update(obligation)

    after = {
        "status": obligation.status.value if hasattr(obligation.status, "value") else str(obligation.status),
        "priority": obligation.priority.value if hasattr(obligation.priority, "value") else str(obligation.priority),
        "description": obligation.description,
        "due_date": obligation.due_date.isoformat() if obligation.due_date else None,
    }

    event_repo = ObligationEventRepository(db)
    await event_repo.create(
        ObligationEvent(
            obligation_id=obligation.id,
            event_type=ObligationEventType.UPDATED,
            description="Obligation updated manually",
            user_id=current_user.id,
            extra_data={"before": before, "after": after},
        )
    )

    await upsert_obligation_activity(
        db,
        obligation,
        preferred_user_id=current_user.id,
    )
    await send_due_soon_notifications_for_obligation(
        db,
        obligation,
        reminder_days=5,
    )

    await db.commit()
    updated = await repo.get_by_id_with_relations(obligation_id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(updated)


@router.delete("/{obligation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_obligation(
    obligation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> None:
    """
    Soft delete an obligation.

    - Admin/Func: can delete any obligation
    - Client: can delete only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete obligations",
        )

    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if not obligation or obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

    await _ensure_client_obligation_access(db, current_user, obligation)

    obligation.deleted_at = datetime.utcnow()
    await repo.update(obligation)

    event_repo = ObligationEventRepository(db)
    await event_repo.create(
        ObligationEvent(
            obligation_id=obligation.id,
            event_type=ObligationEventType.STATUS_CHANGED,
            description="Obligation deleted",
            user_id=current_user.id,
            extra_data={"deleted_at": obligation.deleted_at.isoformat()},
        )
    )

    await db.commit()
    return None


@router.post("/{obligation_id}/restore", response_model=ObligationResponse)
async def restore_obligation(
    obligation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Restore a soft-deleted obligation.

    - Admin/Func: can restore any obligation
    - Client: can restore only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to restore obligations",
        )

    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id, include_deleted=True)
    if not obligation or obligation.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted obligation not found",
        )

    await _ensure_client_obligation_access(db, current_user, obligation)

    obligation.deleted_at = None
    await repo.update(obligation)

    event_repo = ObligationEventRepository(db)
    await event_repo.create(
        ObligationEvent(
            obligation_id=obligation.id,
            event_type=ObligationEventType.STATUS_CHANGED,
            description="Obligation restored",
            user_id=current_user.id,
            extra_data={"restored_from_trash": True},
        )
    )

    await upsert_obligation_activity(
        db,
        obligation,
        preferred_user_id=current_user.id,
    )
    await send_due_soon_notifications_for_obligation(
        db,
        obligation,
        reminder_days=5,
    )

    await db.commit()
    restored = await repo.get_by_id_with_relations(obligation_id)
    if not restored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(restored)


@router.post("/generate", response_model=ObligationGenerateResponse)
async def generate_obligations(
    request: ObligationGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Generate obligations for a specific month.

    Admin/Func only.
    Can generate for one client or all clients.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can generate obligations",
        )

    generator = ObligationGenerator(db)
    repo = ObligationRepository(db)

    if request.client_id:
        # Generate for specific client
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_id(request.client_id)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )

        obligations = await generator.generate_for_client(
            client=client,
            year=request.year,
            month=request.month,
            generated_by_id=current_user.id,
        )

        obligations_with_relations = []
        for ob in obligations:
            ob_full = await repo.get_by_id_with_relations(ob.id)
            if ob_full:
                obligations_with_relations.append(_obligation_to_response(ob_full))

        return {
            "success": True,
            "total_obligations": len(obligations_with_relations),
            "obligations": obligations_with_relations,
        }
    else:
        # Generate for all clients
        stats = await generator.generate_for_all_clients(
            year=request.year,
            month=request.month,
            generated_by_id=current_user.id,
        )

        return {
            "success": True,
            "total_clients": stats["total_clients"],
            "total_obligations": stats["total_obligations"],
            "errors": stats["errors"],
        }


@router.post("/{obligation_id}/receipt", response_model=ObligationResponse)
async def upload_receipt(
    obligation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: Annotated[UploadFile, File()],
    notes: Annotated[Optional[str], Form()] = None,
):
    """
    Upload receipt for an obligation and mark as completed.

    Admin/Func: can process any obligation
    Client: can process only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload receipts",
        )

    repo = ObligationRepository(db)
    current_obligation = await repo.get_by_id_with_relations(obligation_id)
    if not current_obligation or current_obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    await _ensure_client_obligation_access(db, current_user, current_obligation)

    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: PDF, JPEG, PNG",
        )

    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10MB limit",
        )

    # Save file (simplified - in production use proper storage service)
    from pathlib import Path

    # Use relative path that works on Windows and Linux
    upload_dir = Path("uploads/receipts")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Create subdirectory by date for organization
    today = datetime.utcnow().strftime("%Y%m%d")
    date_dir = upload_dir / today
    date_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{obligation_id}_{timestamp}_{file.filename}"
    file_path = date_dir / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    receipt_url = f"/obligations/receipts/{today}/{filename}"

    # Process receipt
    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.process_receipt(
        obligation_id=obligation_id,
        receipt_url=receipt_url,
        processed_by_id=current_user.id,
        notes=notes,
    )

    # Reload with relations
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if obligation:
        await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=current_user.id,
        )
        await db.commit()
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(obligation)


@router.put("/{obligation_id}/due-date", response_model=ObligationResponse)
async def update_due_date(
    obligation_id: UUID,
    request: ObligationUpdateDueDateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Update obligation due date.

    Admin/Func: can update any obligation
    Client: can update only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update due dates",
        )

    repo = ObligationRepository(db)
    existing = await repo.get_by_id_with_relations(obligation_id)
    if not existing or existing.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    await _ensure_client_obligation_access(db, current_user, existing)

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.update_due_date(
        obligation_id=obligation_id,
        new_due_date=request.new_due_date,
        reason=request.reason,
        performed_by_id=current_user.id,
    )

    # Reload with relations
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if obligation:
        await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=current_user.id,
        )
        await send_due_soon_notifications_for_obligation(
            db,
            obligation,
            reminder_days=5,
        )
        await db.commit()
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(obligation)


@router.post("/{obligation_id}/cancel", response_model=ObligationResponse)
async def cancel_obligation(
    obligation_id: UUID,
    request: ObligationCancelRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Cancel an obligation.

    Admin/Func: can cancel any obligation
    Client: can cancel only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel obligations",
        )

    repo = ObligationRepository(db)
    existing = await repo.get_by_id_with_relations(obligation_id)
    if not existing or existing.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    await _ensure_client_obligation_access(db, current_user, existing)

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.cancel_obligation(
        obligation_id=obligation_id,
        reason=request.reason,
        performed_by_id=current_user.id,
    )

    # Reload with relations
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if obligation:
        await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=current_user.id,
        )
        await db.commit()
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(obligation)


@router.post("/{obligation_id}/reopen", response_model=ObligationResponse)
async def reopen_obligation(
    obligation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    notes: Optional[str] = None,
):
    """
    Reopen obligation (mark as pending again).

    Admin/Func: can reopen any obligation
    Client: can reopen only own obligations
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to reopen obligations",
        )

    repo = ObligationRepository(db)
    existing = await repo.get_by_id_with_relations(obligation_id)
    if not existing or existing.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    await _ensure_client_obligation_access(db, current_user, existing)

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.mark_as_pending(
        obligation_id=obligation_id,
        performed_by_id=current_user.id,
        notes=notes,
    )

    # Reload with relations
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if obligation:
        await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=current_user.id,
        )
        await send_due_soon_notifications_for_obligation(
            db,
            obligation,
            reminder_days=5,
        )
        await db.commit()
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(obligation)


@router.get("/{obligation_id}/events", response_model=list[ObligationEventResponse])
async def get_obligation_events(
    obligation_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """Get timeline of events for an obligation."""
    # Verify access to obligation
    repo = ObligationRepository(db)
    obligation = await repo.get(obligation_id)

    if not obligation or obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

    await _ensure_client_obligation_access(db, current_user, obligation)

    # Get events
    event_repo = ObligationEventRepository(db)
    events = await event_repo.list_by_obligation(
        obligation_id=obligation_id,
        skip=skip,
        limit=limit,
    )

    return events


@router.get("/upcoming/pending", response_model=list[ObligationResponse])
async def get_upcoming_obligations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    days_ahead: int = Query(7, ge=1, le=90),
):
    """
    Get pending obligations due in the next X days.

    Admin/Func: See all
    Client: See only their own
    """
    generator = ObligationGenerator(db)
    obligations = await generator.check_pending_obligations(days_ahead=days_ahead)

    # Filter for clients
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if client:
            obligations = [o for o in obligations if o.client_id == client.id]
        else:
            obligations = []

    # Load relations and convert to response
    repo = ObligationRepository(db)
    obligations_with_relations = []
    for ob in obligations:
        ob_with_relations = await repo.get_by_id_with_relations(ob.id)
        if ob_with_relations:
            obligations_with_relations.append(_obligation_to_response(ob_with_relations))

    return obligations_with_relations


@router.get("/overdue/list", response_model=list[ObligationResponse])
async def get_overdue_obligations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Get all overdue obligations.

    Admin/Func: See all
    Client: See only their own
    """
    generator = ObligationGenerator(db)
    obligations = await generator.get_overdue_obligations()

    # Filter for clients
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if client:
            obligations = [o for o in obligations if o.client_id == client.id]
        else:
            obligations = []

    # Load relations and convert to response
    repo = ObligationRepository(db)
    obligations_with_relations = []
    for ob in obligations:
        ob_with_relations = await repo.get_by_id_with_relations(ob.id)
        if ob_with_relations:
            obligations_with_relations.append(_obligation_to_response(ob_with_relations))

    return obligations_with_relations


@router.get("/templates/list", response_model=list[dict])
async def get_obligation_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    servico_contratado: Optional[str] = Query(None, description="Filter by service type"),
):
    """
    Get obligation templates for auto-suggestions.

    Returns templates filtered by service type if provided.
    Admin/Func: Can see all templates
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can access obligation templates",
        )

    from app.db.models.obligation_template import ObligationTemplate
    from sqlalchemy import select

    query = select(ObligationTemplate).where(ObligationTemplate.is_active == True)

    if servico_contratado:
        query = query.where(ObligationTemplate.servico_contratado == servico_contratado)

    query = query.order_by(ObligationTemplate.periodicidade, ObligationTemplate.nome)

    result = await db.execute(query)
    templates = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "nome": t.nome,
            "descricao": t.descricao,
            "periodicidade": t.periodicidade,
            "servico_contratado": t.servico_contratado,
            "dia_vencimento": t.dia_vencimento,
        }
        for t in templates
    ]

@router.post("/{obligation_id}/complete", response_model=ObligationResponse)
async def complete_obligation(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    obligation_id: UUID,
):
    """
    Mark obligation as completed without receipt.
    Quick action for the minimalist panel.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to complete obligations",
        )
    # Get obligation
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if not obligation or obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    await _ensure_client_obligation_access(db, current_user, obligation)

    # Validate status
    if obligation.status == ObligationStatus.CONCLUIDA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Obligation already completed",
        )

    # Update status
    now = datetime.utcnow()
    obligation = await repo.update_status(
        obligation_id=obligation_id,
        status=ObligationStatus.CONCLUIDA,
        completed_at=now,
        processed_by_id=current_user.id,
    )

    # Create event
    event_repo = ObligationEventRepository(db)
    event = ObligationEvent(
        obligation_id=obligation_id,
        event_type=ObligationEventType.STATUS_CHANGED,
        description="Obligation marked as completed",
        user_id=current_user.id,
        extra_data={"completed_at": now.isoformat()},
    )
    await event_repo.create(event)

    obligation = await repo.get_by_id_with_relations(obligation_id)
    if obligation:
        await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=current_user.id,
        )

    await db.commit()
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

    return _obligation_to_response(obligation)


@router.post("/{obligation_id}/undo", response_model=ObligationResponse)
async def undo_obligation(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    obligation_id: UUID,
):
    """
    Undo obligation completion (mark back as pending).
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC, UserRole.CLIENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to undo obligations",
        )

    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if not obligation or obligation.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    await _ensure_client_obligation_access(db, current_user, obligation)

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.mark_as_pending(
        obligation_id=obligation_id,
        performed_by_id=current_user.id,
        notes="Undone from minimalist panel"
    )
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if obligation:
        await upsert_obligation_activity(
            db,
            obligation,
            preferred_user_id=current_user.id,
        )
        await send_due_soon_notifications_for_obligation(
            db,
            obligation,
            reminder_days=5,
        )
        await db.commit()
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )
    return _obligation_to_response(obligation)


@router.get("/list", response_model=list[dict])
async def list_obligations_simple(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    month: int = Query(..., ge=1, le=12, description="Month"),
    year: int = Query(..., ge=2020, le=2100, description="Year"),
    search: Optional[str] = Query(None, description="Search by company name"),
    category: str = Query("clients", description="Category: clients or office"),
):
    """
    Simple list of obligations for matrix view.
    Returns obligations grouped by client with fixed type columns.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can access obligations list",
        )
    from sqlalchemy import select, func
    from app.db.models.client import Client
    from app.db.models.obligation import Obligation
    from app.db.models.obligation_type import ObligationType

    # Fixed obligation types (order matters for frontend)
    FIXED_TYPES = [
        "DAS",
        "DCTFWeb",
        "EFD-Contribuições",
        "ECD",
        "ECF",
        "ISS",
        "FGTS",
        "INSS/eSocial",
    ]

    if category == "office":
        # TODO: Implementar obrigações do escritório
        # Por enquanto retorna lista vazia
        return []

    # Query clients
    query = select(Client).where(
        Client.deleted_at.is_(None),
        Client.status.in_([ClientStatus.ATIVO, ClientStatus.INADIMPLENTE]),
    )
    if search:
        query = query.where(Client.razao_social.ilike(f"%{search}%"))
    query = query.order_by(Client.razao_social)

    result = await db.execute(query)
    clients = result.scalars().all()

    # Build list
    obligations_list = []
    for client in clients:
        # Get client's obligations for this month/year
        oblig_query = select(Obligation).join(ObligationType).where(
            Obligation.client_id == client.id,
            func.extract('month', Obligation.due_date) == month,
            func.extract('year', Obligation.due_date) == year,
            Obligation.deleted_at.is_(None)
        )
        oblig_result = await db.execute(oblig_query)
        obligations = oblig_result.scalars().all()

        # Map obligations by type name
        obligations_by_type = {}
        for ob in obligations:
            if ob.obligation_type:
                type_name = ob.obligation_type.name
                obligations_by_type[type_name] = {
                    "id": str(ob.id),
                    "status": ob.status.value,
                    "receipt_url": ob.receipt_url,
                    "due_date": ob.due_date.isoformat() if ob.due_date else None,
                    "obligation_type_name": ob.obligation_type.name,
                }

        # Build obligations dict for fixed types
        obligations_data = {}
        for type_name in FIXED_TYPES:
            obligations_data[type_name] = obligations_by_type.get(type_name)

        # Calculate progress
        total_applicable = len([v for v in obligations_data.values() if v is not None])
        completed = sum(1 for v in obligations_data.values() if v and v["status"] == "concluida")

        obligations_list.append({
            "client_id": str(client.id),
            "client_name": client.razao_social,
            "client_cnpj": client.cnpj,
            "obligations": obligations_data,
            "progress": {"completed": completed, "total": total_applicable}
        })

    return obligations_list


@router.get("/receipts/{date}/{filename}")
async def download_receipt(
    date: str,
    filename: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Download/view obligation receipt file.

    Admin/Func can download any receipt.
    Clients can only download receipts for their own obligations.
    """
    from pathlib import Path
    from fastapi.responses import FileResponse

    # Construct file path
    file_path = Path("uploads/receipts") / date / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file not found",
        )

    # Verify access (extract obligation_id from filename)
    # Filename format: {obligation_id}_{timestamp}_{original_filename}
    try:
        obligation_id_str = filename.split("_")[0]
        obligation_id = UUID(obligation_id_str)

        # Check if user has access to this obligation
        repo = ObligationRepository(db)
        obligation = await repo.get_by_id(obligation_id)

        if not obligation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Obligation not found",
            )

        # Check access: clients can only see their own
        if current_user.role == UserRole.CLIENTE:
            client_repo = ClientRepository(db)
            client = await client_repo.get_by_user_id(current_user.id, current_user.email)
            if not client or obligation.client_id != client.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this receipt",
                )
    except (IndexError, ValueError):
        # If filename format is invalid, only allow admin
        if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid receipt filename",
            )

    # Determine media type based on file extension
    media_type = "application/octet-stream"
    if filename.lower().endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.lower().endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"
    elif filename.lower().endswith(".png"):
        media_type = "image/png"

    return FileResponse(
        str(file_path),
        media_type=media_type,
        filename=filename,
    )
