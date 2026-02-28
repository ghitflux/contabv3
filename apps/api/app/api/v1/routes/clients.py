"""
Client routes.
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_active_user, get_db, require_admin, require_admin_or_func
from app.db.models.user import User, UserRole
from app.schemas.base import ResponseSchema
from app.schemas.client import (
    ClientCreate,
    ClientCreateResult,
    ClientDraftCreate,
    ClientListItem,
    ClientResponse,
    ClientUpdate,
)
from app.services.client import ClientService

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/me", response_model=ClientResponse, status_code=status.HTTP_200_OK)
async def get_my_client(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> ClientResponse:
    """
    Get current user's client data.
    """
    if current_user.role != UserRole.CLIENTE:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a client"
        )

    service = ClientService(db)
    return await service.get_client_by_user_id(current_user.id)



@router.get("", response_model=dict, status_code=status.HTTP_200_OK)
async def list_clients(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin_or_func()),
    query: Optional[str] = Query(None, description="Search by razao social or CNPJ"),
    cnpj: Optional[str] = Query(None, description="Filter by CNPJ (supports digits-only)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    starts_with: Optional[str] = Query(None, description="Filter by first letter (A-Z)", max_length=1),
    regime_tributario: Optional[str] = Query(None, description="Filter by tax regime"),
    tipo_empresa: Optional[str] = Query(None, description="Filter by company type"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=0, le=100, description="Page size (0 = all clients)"),
) -> dict:
    """
    List all clients with filters and pagination (admin or func only).

    Args:
        db: Database session
        _: Current user (must be admin or func)
        query: Optional search term
        status_filter: Optional status filter
        starts_with: Optional first letter filter
        page: Page number (1-indexed)
        size: Page size

    Returns:
        Paginated list of clients
    """
    service = ClientService(db)
    return await service.list_clients(
        query=query,
        cnpj=cnpj,
        status=status_filter,
        starts_with=starts_with,
        regime_tributario=regime_tributario,
        tipo_empresa=tipo_empresa,
        page=page,
        size=size,
    )


@router.get("/search", response_model=dict, status_code=status.HTTP_200_OK)
async def search_clients(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin_or_func()),
    q: str = Query(..., min_length=1, description="Search term"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
) -> dict:
    """
    Quick search for autocomplete (admin or func only).

    Args:
        db: Database session
        _: Current user (must be admin or func)
        q: Search term
        limit: Maximum results

    Returns:
        List of matching clients
    """
    service = ClientService(db)
    results = await service.search_clients(q, limit)
    return {"items": results}


@router.get("/{client_id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
async def get_client(
    client_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> ClientResponse:
    """
    Get client by ID.

    Admin and func can see any client.
    Cliente users can only see their own data.

    Args:
        client_id: Client UUID
        db: Database session
        current_user: Current authenticated user

    Returns:
        Client data

    Raises:
        HTTPException: 403 if not authorized, 404 if not found
    """
    service = ClientService(db)
    client = await service.get_client(client_id)

    # Check authorization for cliente users
    if current_user.role == UserRole.CLIENTE:
        if client.user_id and client.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this client"
            )

        if not client.user_id and client.email != current_user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this client"
            )

    return client


@router.post("", response_model=ClientCreateResult, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> ClientCreateResult:
    """
    Create a new client (admin or func only).

    Args:
        client_data: Client creation data
        db: Database session
        _: Current user (must be admin or func)

    Returns:
        Created client

    Raises:
        HTTPException: 409 if CNPJ already exists
    """
    service = ClientService(db)
    return await service.create_client(client_data, created_by_id=current_user.id)


@router.put("/{client_id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(require_admin_or_func()),
) -> ClientResponse:
    """
    Update client (admin or func only).

    Args:
        client_id: Client UUID
        client_data: Client update data
        db: Database session
        current_user: Current user (must be admin or func)

    Returns:
        Updated client

    Raises:
        HTTPException: 404 if not found, 409 if CNPJ conflict
    """
    service = ClientService(db)
    return await service.update_client(client_id, client_data, updated_by_id=current_user.id)


@router.delete("/{client_id}", response_model=ResponseSchema, status_code=status.HTTP_200_OK)
async def delete_client(
    client_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> ResponseSchema:
    """
    Delete client (soft delete, admin/func only).

    Args:
        client_id: Client UUID
        db: Database session
        _: Current user (must be admin/func)

    Returns:
        Success message

    Raises:
        HTTPException: 404 if not found
    """
    service = ClientService(db)
    await service.delete_client(client_id)

    return ResponseSchema(
        success=True,
        message="Client deleted successfully"
    )


@router.get("/stats/summary", response_model=dict, status_code=status.HTTP_200_OK)
async def get_client_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin_or_func()),
) -> dict:
    """
    Get client statistics and KPIs (admin or func only).

    Returns:
        Client statistics including totals by status and regime

    Args:
        db: Database session
        _: Current user (must be admin or func)
    """
    service = ClientService(db)
    return await service.get_stats()


@router.post("/drafts", response_model=ResponseSchema, status_code=status.HTTP_201_CREATED)
async def save_client_draft(
    draft_data: ClientDraftCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
) -> ResponseSchema:
    """
    Save client form as draft for auto-save functionality.

    Args:
        draft_data: Draft data with partial client info
        db: Database session
        current_user: Current authenticated user

    Returns:
        Success message with draft ID
    """
    service = ClientService(db)
    draft_id = await service.save_draft(draft_data, current_user.id)

    return ResponseSchema(
        success=True,
        message="Draft saved successfully",
        data={"draft_id": str(draft_id)}
    )
