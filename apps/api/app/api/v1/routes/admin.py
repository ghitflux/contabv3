"""Admin API routes for maintenance tasks."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from uuid import uuid4

from app.api.v1.deps import get_current_active_user, get_db
from app.db.models.user import User, UserRole
from app.db.models.client import Client
from app.services.obligation.generator import ObligationGenerator
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

    # Check existing
    result = await db.execute(text("SELECT COUNT(*) FROM obligation_types"))
    count = result.scalar()

    # Check obligations
    result = await db.execute(text("SELECT COUNT(*) FROM obligations"))
    obligations_count = result.scalar()

    if count and count > 0:
        if obligations_count and obligations_count > 0:
            return {
                "message": f"Found {count} existing obligation types with {obligations_count} obligations. Skipping to preserve data.",
                "skipped": True
            }
        else:
            # Delete and recreate
            await db.execute(text("DELETE FROM obligation_types"))
            await db.commit()

    # Define obligation types
    obligation_types = [
        {
            "name": "DAS",
            "code": "DAS_MENSAL",
            "description": "Documento de Arrecadação do Simples Nacional",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": True,
            "applies_to_simples": True,
            "applies_to_presumido": False,
            "applies_to_real": False,
            "recurrence": "mensal",
            "day_of_month": 20,
        },
        {
            "name": "DCTFWeb",
            "code": "DCTF_MENSAL",
            "description": "Declaração de Débitos e Créditos Tributários Federais",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": False,
            "applies_to_simples": False,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "mensal",
            "day_of_month": 20,
        },
        {
            "name": "EFD-Contribuições",
            "code": "EFD_CONTRIBUICOES",
            "description": "Escrituração Fiscal Digital - Contribuições",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": False,
            "applies_to_simples": False,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "mensal",
            "day_of_month": 15,
        },
        {
            "name": "ISS",
            "code": "NFS_E_MENSAL",
            "description": "Nota Fiscal de Serviços Eletrônica / ISS",
            "applies_to_commerce": False,
            "applies_to_service": True,
            "applies_to_industry": False,
            "applies_to_mei": True,
            "applies_to_simples": True,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "mensal",
            "day_of_month": 20,
        },
        {
            "name": "FGTS",
            "code": "FGTS_MENSAL",
            "description": "Fundo de Garantia do Tempo de Serviço",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": False,
            "applies_to_simples": True,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "mensal",
            "day_of_month": 7,
        },
        {
            "name": "INSS/eSocial",
            "code": "ESOCIAL_MENSAL",
            "description": "eSocial / Instituto Nacional do Seguro Social",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": True,
            "applies_to_simples": True,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "mensal",
            "day_of_month": 7,
        },
        {
            "name": "ECD",
            "code": "ECD",
            "description": "Escrituração Contábil Digital",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": False,
            "applies_to_simples": False,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "anual",
            "day_of_month": 31,
            "month_of_year": 5,
        },
        {
            "name": "ECF",
            "code": "ECF",
            "description": "Escrituração Contábil Fiscal",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": False,
            "applies_to_simples": False,
            "applies_to_presumido": True,
            "applies_to_real": True,
            "recurrence": "anual",
            "day_of_month": 31,
            "month_of_year": 7,
        },
        {
            "name": "DEFIS",
            "code": "DEFIS",
            "description": "Declaração de Informações Socioeconômicas e Fiscais",
            "applies_to_commerce": True,
            "applies_to_service": True,
            "applies_to_industry": True,
            "applies_to_mei": True,
            "applies_to_simples": True,
            "applies_to_presumido": False,
            "applies_to_real": False,
            "recurrence": "anual",
            "day_of_month": 31,
            "month_of_year": 3,
        },
    ]

    # Insert using SQL
    for ot_data in obligation_types:
        stmt = text("""
            INSERT INTO obligation_types
            (id, name, code, description, applies_to_commerce, applies_to_service,
             applies_to_industry, applies_to_mei, applies_to_simples, applies_to_presumido,
             applies_to_real, recurrence, day_of_month, month_of_year, is_active)
            VALUES
            (:id, :name, :code, :description, :applies_to_commerce, :applies_to_service,
             :applies_to_industry, :applies_to_mei, :applies_to_simples, :applies_to_presumido,
             :applies_to_real, CAST(:recurrence AS obligationrecurrence), :day_of_month, :month_of_year, :is_active)
        """)
        await db.execute(stmt, {
            "id": uuid4(),
            "name": ot_data["name"],
            "code": ot_data["code"],
            "description": ot_data["description"],
            "applies_to_commerce": ot_data["applies_to_commerce"],
            "applies_to_service": ot_data["applies_to_service"],
            "applies_to_industry": ot_data["applies_to_industry"],
            "applies_to_mei": ot_data["applies_to_mei"],
            "applies_to_simples": ot_data["applies_to_simples"],
            "applies_to_presumido": ot_data["applies_to_presumido"],
            "applies_to_real": ot_data["applies_to_real"],
            "recurrence": ot_data["recurrence"],
            "day_of_month": ot_data.get("day_of_month"),
            "month_of_year": ot_data.get("month_of_year"),
            "is_active": ot_data.get("is_active", True),
        })

    await db.commit()
    return {"message": f"Created {len(obligation_types)} obligation types", "count": len(obligation_types)}


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
    result = await db.execute(select(Client).where(Client.status == "ativo", Client.deleted_at.is_(None)))
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
