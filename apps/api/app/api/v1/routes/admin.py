"""Admin API routes for maintenance tasks."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.user import User, UserRole
from app.db.models.client import Client, ClientStatus
from app.services.obligation.generator import ObligationGenerator
from app.services.obligation.seed_types import ensure_obligation_types
from datetime import date

router = APIRouter()


@router.post("/seed/obligation-types")
async def seed_obligation_types(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Seed obligation types into database.
    Admin/Funcionario only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and funcionarios can seed data"
        )

    created = await ensure_obligation_types(db)
    message = "Obligation types already seeded." if created == 0 else f"Created {created} obligation types"
    return {"message": message, "count": created}


@router.post("/seed/obligations")
async def seed_obligations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Generate obligations for current and previous month for all clients.
    Admin/Funcionario only.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.FUNC]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and funcionarios can seed data"
        )

    # Get active clients
    result = await db.execute(
        select(Client).where(
            Client.status.in_([ClientStatus.ATIVO, ClientStatus.INADIMPLENTE]),
            Client.deleted_at.is_(None),
        )
    )
    clients = result.scalars().all()

    if not clients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active clients found. Please create clients first."
        )

    generator = ObligationGenerator(db)
    current_date = date.today()
    current_year = current_date.year
    current_month = current_date.month

    results = []

    # Generate for current month
    stats = await generator.generate_for_all_clients(
        year=current_year,
        month=current_month,
    )
    results.append({
        "period": f"{current_year}-{current_month:02d}",
        "obligations": stats['total_obligations'],
        "clients": stats['total_clients']
    })

    # Generate for previous month
    prev_month = current_month - 1
    prev_year = current_year
    if prev_month == 0:
        prev_month = 12
        prev_year -= 1

    stats = await generator.generate_for_all_clients(
        year=prev_year,
        month=prev_month,
    )
    results.append({
        "period": f"{prev_year}-{prev_month:02d}",
        "obligations": stats['total_obligations'],
        "clients": stats['total_clients']
    })

    await db.commit()

    return {
        "message": "Obligations generated successfully",
        "results": results
    }
