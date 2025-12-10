"""
Municipal Registration API routes.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db, require_admin_or_func
from app.db.models.user import User, UserRole
from app.db.repositories.municipal_registration import MunicipalRegistrationRepository
from app.db.repositories.client import ClientRepository
from app.schemas.base import ResponseSchema
from app.schemas.municipal_registration import (
    MunicipalRegistrationCreate,
    MunicipalRegistrationListResponse,
    MunicipalRegistrationResponse,
    MunicipalRegistrationUpdate,
)
from app.db.models.municipal_registration import MunicipalRegistration
from app.schemas.municipal_registration import MunicipalRegistrationStatus

router = APIRouter(prefix="/municipal-registrations", tags=["municipal-registrations"])


@router.get("", response_model=MunicipalRegistrationListResponse, status_code=status.HTTP_200_OK)
async def list_municipal_registrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
    client_id: Optional[UUID] = Query(None, description="Filter by client ID"),
    state: Optional[str] = Query(None, description="Filter by state (UF)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    city: Optional[str] = Query(None, description="Filter by city name"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
) -> MunicipalRegistrationListResponse:
    """
    List municipal registrations with filters and pagination.

    - Admin/Func: Can see all registrations
    - Client: Can only see their own registrations
    """
    repo = MunicipalRegistrationRepository(db)

    # If user is client, get their client_id
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client profile not found",
            )
        client_id = client.id

    # Parse filters
    state_enum = None
    if state:
        try:
            from app.schemas.municipal_registration import StateCode
            state_enum = StateCode(state.upper())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid state: {state}",
            )

    status_enum = None
    if status_filter:
        try:
            status_enum = MunicipalRegistrationStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    # List registrations
    skip = (page - 1) * size
    registrations, total = await repo.list_with_filters(
        client_id=client_id,
        state=state_enum,
        status=status_enum,
        city=city,
        skip=skip,
        limit=size,
    )

    items = [
        MunicipalRegistrationResponse(
            id=reg.id,
            client_id=reg.client_id,
            city=reg.city,
            state=reg.state,
            registration_number=reg.registration_number,
            issue_date=reg.issue_date,
            status=reg.status,
            notes=reg.notes,
            created_at=reg.created_at,
            updated_at=reg.updated_at,
        )
        for reg in registrations
    ]

    return MunicipalRegistrationListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total > 0 else 0,
    )


@router.post("", response_model=MunicipalRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def create_municipal_registration(
    registration_data: MunicipalRegistrationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> MunicipalRegistrationResponse:
    """
    Create a new municipal registration (admin or func only).
    """
    repo = MunicipalRegistrationRepository(db)

    # Check if registration already exists
    exists = await repo.registration_exists(
        city=registration_data.city,
        state=registration_data.state,
        registration_number=registration_data.registration_number,
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Municipal registration already exists for this city, state and registration number",
        )

    # Create registration
    registration = MunicipalRegistration(
        client_id=registration_data.client_id,
        city=registration_data.city,
        state=registration_data.state,
        registration_number=registration_data.registration_number,
        issue_date=registration_data.issue_date,
        status=MunicipalRegistrationStatus.ATIVA,
        notes=registration_data.notes,
    )

    registration = await repo.create(registration)
    await db.commit()
    await db.refresh(registration)

    return MunicipalRegistrationResponse(
        id=registration.id,
        client_id=registration.client_id,
        city=registration.city,
        state=registration.state,
        registration_number=registration.registration_number,
        issue_date=registration.issue_date,
        status=registration.status,
        notes=registration.notes,
        created_at=registration.created_at,
        updated_at=registration.updated_at,
    )


@router.put("/{registration_id}", response_model=MunicipalRegistrationResponse, status_code=status.HTTP_200_OK)
async def update_municipal_registration(
    registration_id: UUID,
    registration_data: MunicipalRegistrationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> MunicipalRegistrationResponse:
    """
    Update a municipal registration (admin or func only).
    """
    repo = MunicipalRegistrationRepository(db)

    registration = await repo.get_by_id(registration_id)
    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Municipal registration not found",
        )

    # Check uniqueness if registration_number changed
    update_data = registration_data.model_dump(exclude_unset=True)
    if "registration_number" in update_data or "city" in update_data or "state" in update_data:
        new_city = update_data.get("city", registration.city)
        new_state = update_data.get("state", registration.state)
        new_number = update_data.get("registration_number", registration.registration_number)

        exists = await repo.registration_exists(
            city=new_city,
            state=new_state,
            registration_number=new_number,
            exclude_id=registration_id,
        )
        if exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Municipal registration already exists for this city, state and registration number",
            )

    # Update fields
    for key, value in update_data.items():
        setattr(registration, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(registration)

    return MunicipalRegistrationResponse(
        id=registration.id,
        client_id=registration.client_id,
        city=registration.city,
        state=registration.state,
        registration_number=registration.registration_number,
        issue_date=registration.issue_date,
        status=registration.status,
        notes=registration.notes,
        created_at=registration.created_at,
        updated_at=registration.updated_at,
    )

