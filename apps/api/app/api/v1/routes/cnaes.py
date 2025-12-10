"""
CNAE API routes.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db, require_admin_or_func
from app.db.models.user import User, UserRole
from app.db.repositories.cnae import CnaeRepository
from app.db.repositories.client import ClientRepository
from app.schemas.base import ResponseSchema
from app.schemas.cnae import CnaeCreate, CnaeListResponse, CnaeResponse, CnaeUpdate
from app.services.cnae.validator import CnaeValidator

router = APIRouter(prefix="/cnaes", tags=["cnaes"])


@router.get("", response_model=CnaeListResponse, status_code=status.HTTP_200_OK)
async def list_cnaes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
    client_id: Optional[UUID] = Query(None, description="Filter by client ID"),
) -> CnaeListResponse:
    """
    List CNAEs.

    - Admin/Func: Can see all CNAEs or filter by client
    - Client: Can only see their own CNAEs
    """
    repo = CnaeRepository(db)

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

    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id is required",
        )

    cnaes = await repo.get_by_client(client_id, active_only=False)

    items = [
        CnaeResponse(
            id=cnae.id,
            client_id=cnae.client_id,
            cnae_code=cnae.cnae_code,
            description=cnae.description,
            cnae_type=cnae.cnae_type,
            is_active=cnae.is_active,
            created_at=cnae.created_at,
        )
        for cnae in cnaes
    ]

    return CnaeListResponse(items=items, total=len(items))


@router.post("", response_model=CnaeResponse, status_code=status.HTTP_201_CREATED)
async def create_cnae(
    cnae_data: CnaeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> CnaeResponse:
    """
    Create a new CNAE (admin or func only).
    """
    from app.db.models.cnae import Cnae

    repo = CnaeRepository(db)
    validator = CnaeValidator(db)

    # Validate format
    is_valid, error = validator.validate_format(cnae_data.cnae_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error,
        )

    # Validate unique
    is_unique, error = await validator.validate_unique_cnae(
        client_id=cnae_data.client_id,
        cnae_code=cnae_data.cnae_code,
    )
    if not is_unique:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error,
        )

    # Validate primary constraint
    from app.schemas.cnae import CnaeType
    if cnae_data.cnae_type == CnaeType.PRINCIPAL:
        is_valid, error = await validator.validate_primary_constraint(cnae_data.client_id)
        if not is_valid:
            # Unset existing primary
            existing_primary = await repo.get_primary(cnae_data.client_id)
            if existing_primary:
                from app.schemas.cnae import CnaeType
                existing_primary.cnae_type = CnaeType.SECUNDARIO
            # Still raise error to inform user
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error,
            )

    # Create CNAE
    cnae = Cnae(
        client_id=cnae_data.client_id,
        cnae_code=cnae_data.cnae_code,
        description=cnae_data.description,
        cnae_type=cnae_data.cnae_type,
        is_active=True,
    )

    cnae = await repo.create(cnae)
    await db.commit()
    await db.refresh(cnae)

    return CnaeResponse(
        id=cnae.id,
        client_id=cnae.client_id,
        cnae_code=cnae.cnae_code,
        description=cnae.description,
        cnae_type=cnae.cnae_type,
        is_active=cnae.is_active,
        created_at=cnae.created_at,
    )


@router.put("/{cnae_id}/set-primary", response_model=CnaeResponse, status_code=status.HTTP_200_OK)
async def set_primary_cnae(
    cnae_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> CnaeResponse:
    """
    Set a CNAE as primary for its client (admin or func only).
    """
    repo = CnaeRepository(db)

    # Get CNAE
    cnae = await repo.get_by_id(cnae_id)
    if not cnae:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CNAE not found",
        )

    # Set as primary
    updated_cnae = await repo.set_as_primary(cnae_id, cnae.client_id)
    await db.commit()
    await db.refresh(updated_cnae)

    return CnaeResponse(
        id=updated_cnae.id,
        client_id=updated_cnae.client_id,
        cnae_code=updated_cnae.cnae_code,
        description=updated_cnae.description,
        cnae_type=updated_cnae.cnae_type,
        is_active=updated_cnae.is_active,
        created_at=updated_cnae.created_at,
    )


@router.delete("/{cnae_id}", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def delete_cnae(
    cnae_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> ResponseSchema:
    """
    Delete a CNAE (admin or func only).
    """
    repo = CnaeRepository(db)

    cnae = await repo.get_by_id(cnae_id)
    if not cnae:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CNAE not found",
        )

    await repo.delete(cnae_id)
    await db.commit()

    return ResponseSchema(message="CNAE deleted successfully")

