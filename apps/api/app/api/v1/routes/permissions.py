"""
Permissions routes for role-based access control.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_admin
from app.db.models.user import User
from app.db.models.permission import Permission, RolePermission
from app.db.repositories.permission import PermissionRepository, RolePermissionRepository
from app.schemas.settings import PermissionResponse, RolePermissionsUpdate
from app.schemas.base import PaginatedResponse

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("", response_model=PaginatedResponse, status_code=status.HTTP_200_OK)
async def list_permissions(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
    category: str | None = None,
    _: User = Depends(require_admin()),
):
    """
    List all permissions with optional filtering by category (admin only).

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        category: Optional category filter
        _: Current user (must be admin)

    Returns:
        PaginatedResponse: Paginated list of permissions
    """
    repo = PermissionRepository(db)

    if category:
        permissions = await repo.get_by_category(category, skip, limit)
        # Get total count for the category
        all_perms = await repo.get_by_category(category, 0, 10000)
        total = len(all_perms)
    else:
        permissions = await repo.get_all(skip, limit)
        # Get total count
        all_perms = await repo.get_all(0, 10000)
        total = len(all_perms)

    return PaginatedResponse.create(
        items=[PermissionResponse.model_validate(p) for p in permissions],
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        size=limit,
    )


@router.get("/{permission_id}", response_model=PermissionResponse, status_code=status.HTTP_200_OK)
async def get_permission(
    permission_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
) -> PermissionResponse:
    """
    Get permission by ID (admin only).

    Args:
        permission_id: Permission UUID
        db: Database session
        _: Current user (must be admin)

    Returns:
        PermissionResponse: Permission data

    Raises:
        HTTPException: 404 if permission not found
    """
    repo = PermissionRepository(db)
    permission = await repo.get_by_id(permission_id)

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    return PermissionResponse.model_validate(permission)


@router.get("/roles/{role}/permissions", status_code=status.HTTP_200_OK)
async def get_role_permissions(
    role: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
):
    """
    Get all permissions assigned to a role (admin only).

    Args:
        role: Role name (admin, func, cliente)
        db: Database session
        _: Current user (must be admin)

    Returns:
        dict: Role permissions mapping
    """
    if role not in ["admin", "func", "cliente"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )

    repo = RolePermissionRepository(db)
    role_permissions = await repo.get_by_role(role)

    return {
        "role": role,
        "permissions": [
            {
                "permission_id": str(rp.permission_id),
                "granted": rp.granted,
            }
            for rp in role_permissions
        ]
    }


@router.put("/roles/{role}/permissions", status_code=status.HTTP_200_OK)
async def update_role_permissions(
    role: str,
    update_data: RolePermissionsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: User = Depends(require_admin()),
):
    """
    Update permissions for a role (admin only).

    Args:
        role: Role name (admin, func, cliente)
        update_data: Map of permission_id to granted boolean
        db: Database session
        _: Current user (must be admin)

    Returns:
        dict: Updated role permissions

    Raises:
        HTTPException: 400 if invalid role
    """
    if role not in ["admin", "func", "cliente"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )

    repo = RolePermissionRepository(db)
    perm_repo = PermissionRepository(db)

    # Update permissions
    for permission_id_str, granted in update_data.permissions.items():
        try:
            permission_id = UUID(permission_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission ID: {permission_id_str}"
            )

        # Check if permission exists
        permission = await perm_repo.get_by_id(permission_id)
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Permission not found: {permission_id}"
            )

        # Get or create role permission
        role_perm = await repo.get_by_role_and_permission(role, permission_id)

        if role_perm:
            role_perm.granted = granted
            role_perm = await repo.update(role_perm)
        else:
            role_perm = RolePermission(
                role=role,
                permission_id=permission_id,
                granted=granted,
            )
            role_perm = await repo.create(role_perm)

    await db.commit()

    # Return updated permissions
    role_permissions = await repo.get_by_role(role)

    return {
        "role": role,
        "permissions": [
            {
                "permission_id": str(rp.permission_id),
                "granted": rp.granted,
            }
            for rp in role_permissions
        ]
    }
