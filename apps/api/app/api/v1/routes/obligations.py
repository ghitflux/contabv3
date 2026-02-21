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
from app.db.models.user import User, UserRole
from app.db.models.obligation import Obligation, ObligationStatus
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
    ObligationUpdateDueDateRequest,
    ObligationCancelRequest,
)
from app.services.obligation.processor import ObligationProcessor
from app.services.obligation.generator import ObligationGenerator
from app.websockets.manager import manager as websocket_manager

router = APIRouter()


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
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
):
    """
    List obligations with filters.

    - Admin/Func: Can see all obligations (client_id optional)
    - Client: Can only see their own obligations
    """
    repo = ObligationRepository(db)

    # If user is client, override client_id filter
    if current_user.role == UserRole.CLIENTE:
        # Get client associated with this user
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        client_id = client.id
    # Admin/Func can see all obligations if client_id is not provided

    obligations, total = await repo.list_by_client(
        client_id=client_id,
        status=status,
        year=year,
        month=month,
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
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can access obligations matrix",
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

    from app.db.models.client import Client

    clients = []
    office_client_id = settings.OFFICE_CLIENT_ID
    if category == "office":
        if not office_client_id:
            return []
        office_stmt = select(Client).where(Client.id == office_client_id)
        office_result = await db.execute(office_stmt)
        office_client = office_result.scalar_one_or_none()
        if not office_client:
            return []
        clients = [office_client]
    else:
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
                detail="Not authorized to access this obligation",
            )

    return _obligation_to_response(obligation)


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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can upload receipts",
        )

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
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can update due dates",
        )

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.update_due_date(
        obligation_id=obligation_id,
        new_due_date=request.new_due_date,
        reason=request.reason,
        performed_by_id=current_user.id,
    )

    # Reload with relations
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can cancel obligations",
        )

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.cancel_obligation(
        obligation_id=obligation_id,
        reason=request.reason,
        performed_by_id=current_user.id,
    )

    # Reload with relations
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
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

    Admin/Func only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can reopen obligations",
        )

    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.mark_as_pending(
        obligation_id=obligation_id,
        performed_by_id=current_user.id,
        notes=notes,
    )

    # Reload with relations
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
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
                detail="Not authorized to access this obligation",
            )

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
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can complete obligations",
        )
    processor = ObligationProcessor(db, websocket_manager)

    # Get obligation
    repo = ObligationRepository(db)
    obligation = await repo.get_by_id_with_relations(obligation_id)
    if not obligation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obligation not found",
        )

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
    from app.db.models.obligation_event import ObligationEvent, ObligationEventType
    event = ObligationEvent(
        obligation_id=obligation_id,
        event_type=ObligationEventType.STATUS_CHANGED,
        description="Obligation marked as completed",
        user_id=current_user.id,
        extra_data={"completed_at": now.isoformat()},
    )
    await event_repo.create(event)

    await db.commit()
    await db.refresh(obligation)

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
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/func can undo obligations",
        )
    processor = ObligationProcessor(db, websocket_manager)
    obligation = await processor.mark_as_pending(
        obligation_id=obligation_id,
        performed_by_id=current_user.id,
        notes="Undone from minimalist panel"
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
    query = select(Client).where(Client.deleted_at.is_(None), Client.status == "ativo")
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
