"""
License API routes.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db, require_admin_or_func
from app.db.models.user import User, UserRole
from app.db.repositories.client import ClientRepository
from app.schemas.base import ResponseSchema
from app.schemas.license import (
    LicenseCreate,
    LicenseListResponse,
    LicenseRenewal,
    LicenseResponse,
    LicenseUpdate,
    LicenseEventResponse,
)
from app.services.license import LicenseService

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.get("", response_model=LicenseListResponse, status_code=status.HTTP_200_OK)
async def list_licenses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
    query: Optional[str] = Query(None, description="Search by registration number or issuing authority"),
    license_type: Optional[str] = Query(None, description="Filter by license type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    client_id: Optional[UUID] = Query(None, description="Filter by client ID"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
) -> LicenseListResponse:
    """
    List all licenses with filters and pagination.

    - Admin/Func: Can see all licenses
    - Client: Can only see their own licenses
    """
    from app.db.repositories.license import LicenseRepository
    from app.schemas.license import LicenseType, LicenseStatus

    repo = LicenseRepository(db)
    service = LicenseService(db)

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
    license_type_enum = None
    if license_type:
        try:
            license_type_enum = LicenseType(license_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid license_type: {license_type}",
            )

    status_enum = None
    if status_filter:
        try:
            status_enum = LicenseStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    # List licenses
    skip = (page - 1) * size
    licenses, total = await repo.list_with_filters(
        query=query,
        license_type=license_type_enum,
        status=status_enum,
        client_id=client_id,
        skip=skip,
        limit=size,
    )

    # Convert to response
    items = [service._to_response(lic) for lic in licenses]

    return LicenseListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total > 0 else 0,
    )


@router.post("", response_model=LicenseResponse, status_code=status.HTTP_201_CREATED)
async def create_license(
    license_data: LicenseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> LicenseResponse:
    """
    Create a new license (admin or func only).
    """
    service = LicenseService(db)
    return await service.create_license(license_data, user_id=current_user.id)


@router.get("/{license_id}", response_model=LicenseResponse, status_code=status.HTTP_200_OK)
async def get_license(
    license_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> LicenseResponse:
    """
    Get license by ID.

    - Admin/Func: Can see any license
    - Client: Can only see their own licenses
    """
    from app.db.repositories.license import LicenseRepository

    repo = LicenseRepository(db)
    service = LicenseService(db)

    license_obj = await repo.get_by_id(license_id)
    if not license_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="License not found",
        )

    # Check authorization for clients
    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or license_obj.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this license",
            )

    return service._to_response(license_obj)


@router.put("/{license_id}", response_model=LicenseResponse, status_code=status.HTTP_200_OK)
async def update_license(
    license_id: UUID,
    license_data: LicenseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> LicenseResponse:
    """
    Update a license (admin or func only).
    """
    service = LicenseService(db)
    return await service.update_license(license_id, license_data, user_id=current_user.id)


@router.delete("/{license_id}", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def delete_license(
    license_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> ResponseSchema:
    """
    Delete a license (admin or func only).
    """
    service = LicenseService(db)
    await service.delete_license(license_id, user_id=current_user.id)
    return ResponseSchema(message="License deleted successfully")


@router.post("/{license_id}/renew", response_model=LicenseResponse, status_code=status.HTTP_200_OK)
async def renew_license(
    license_id: UUID,
    renewal_data: LicenseRenewal,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> LicenseResponse:
    """
    Renew a license (admin or func only).
    """
    service = LicenseService(db)
    return await service.renew_license(license_id, renewal_data, user_id=current_user.id)


@router.get("/{license_id}/events", response_model=list[LicenseEventResponse], status_code=status.HTTP_200_OK)
async def get_license_events(
    license_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> list[LicenseEventResponse]:
    """
    Get all events for a license.

    - Admin/Func: Can see events for any license
    - Client: Can only see events for their own licenses
    """
    from app.db.repositories.license import LicenseRepository

    repo = LicenseRepository(db)

    # Check license exists and authorization
    license_obj = await repo.get_by_id(license_id)
    if not license_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="License not found",
        )

    if current_user.role == UserRole.CLIENTE:
        client_repo = ClientRepository(db)
        client = await client_repo.get_by_user_id(current_user.id, current_user.email)
        if not client or license_obj.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this license",
            )

    events = await repo.get_events(license_id)

    return [
        LicenseEventResponse(
            id=event.id,
            license_id=event.license_id,
            event_type=event.event_type,
            description=event.description,
            user_id=event.user_id,
            created_at=event.created_at,
            user_name=None,  # TODO: Populate from user if needed
        )
        for event in events
    ]


@router.post("/check-expirations", response_model=dict, status_code=status.HTTP_200_OK)
async def check_expirations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> dict:
    """
    Manually trigger license expiration check (admin or func only).
    Returns summary of expiring licenses.
    """
    from app.tasks.license_expiration import run_check_license_expirations

    summary = await run_check_license_expirations()
    return summary

