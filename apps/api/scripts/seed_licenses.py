"""
Script to seed licenses for clients.
"""

import asyncio
import sys
from pathlib import Path
from datetime import date, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.models.client import Client
from app.db.models.license import License
from app.schemas.license import LicenseType, LicenseStatus

settings = get_settings()


async def seed_licenses():
    """Seed licenses for clients."""
    DATABASE_URL = str(settings.DATABASE_URL)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get all active clients
        from sqlalchemy import select
        result = await session.execute(select(Client).where(Client.status == "ativo"))
        clients = result.scalars().all()

        if not clients:
            print("No active clients found. Please run seed_clients.py first.")
            await engine.dispose()
            return

        # Check if licenses already exist
        result = await session.execute(select(License))
        existing = result.scalars().all()

        if existing:
            print(f"Found {len(existing)} existing licenses. Skipping seed.")
            await engine.dispose()
            return

        license_types_data = [
            {
                "type": LicenseType.ALVARA_FUNCIONAMENTO,
                "authority": "Prefeitura Municipal",
                "duration_days": 365,
            },
            {
                "type": LicenseType.INSCRICAO_ESTADUAL,
                "authority": "Secretaria da Fazenda Estadual",
                "duration_days": None,  # Permanent
            },
            {
                "type": LicenseType.INSCRICAO_MUNICIPAL,
                "authority": "Prefeitura Municipal",
                "duration_days": None,  # Permanent
            },
            {
                "type": LicenseType.CERTIFICADO_DIGITAL,
                "authority": "Receita Federal",
                "duration_days": 365,
            },
        ]

        licenses_created = 0
        for client in clients:
            for i, lt_data in enumerate(license_types_data):
                issue_date = date.today() - timedelta(days=30 * (i + 1))
                expiration_date = None
                if lt_data["duration_days"]:
                    expiration_date = issue_date + timedelta(days=lt_data["duration_days"])

                # Determine status
                if expiration_date and expiration_date < date.today():
                    status = LicenseStatus.VENCIDA
                elif expiration_date and expiration_date < date.today() + timedelta(days=30):
                    status = LicenseStatus.PENDENTE_RENOVACAO
                else:
                    status = LicenseStatus.ATIVA

                license_obj = License(
                    client_id=client.id,
                    license_type=lt_data["type"],
                    registration_number=f"{lt_data['type'].value[:3].upper()}-{client.cnpj[:8]}-{i+1:03d}",
                    issuing_authority=lt_data["authority"],
                    issue_date=issue_date,
                    expiration_date=expiration_date,
                    status=status,
                    notes=f"Licença gerada automaticamente para {client.razao_social}",
                )
                session.add(license_obj)
                licenses_created += 1

        await session.commit()
        print(f"Created {licenses_created} licenses for {len(clients)} clients")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_licenses())

