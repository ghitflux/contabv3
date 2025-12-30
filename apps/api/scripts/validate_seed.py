"""
Script para validar os dados criados pelo seed completo.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

from app.core.config import get_settings
from app.db.models.client import Client
from app.db.models.finance import FinancialTransaction
from app.db.models.obligation import Obligation
from app.db.models.license import License

settings = get_settings()


async def validate_seed():
    """Valida os dados criados pelo seed."""
    print("\n" + "="*70)
    print("VALIDACAO DOS DADOS DO SEED")
    print("="*70)

    DATABASE_URL = str(settings.DATABASE_URL)
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Validar Clientes
        print("\n>> CLIENTES:")
        result = await session.execute(select(Client).limit(5))
        clients = result.scalars().all()

        print(f"   Total de clientes: {len(clients)}")
        for client in clients:
            print(f"\n   - {client.razao_social}")
            print(f"     CNPJ: {client.cnpj}")
            print(f"     Regime: {client.regime_tributario.value}")
            print(f"     Tipo: {client.tipo_empresa.value}")
            print(f"     Honorarios: R$ {client.honorarios_mensais}")
            print(f"     Email: {client.email}")

        # Validar Obrigações
        print("\n>> OBRIGACOES:")
        result = await session.execute(
            select(func.count()).select_from(Obligation)
        )
        total_obligations = result.scalar()
        print(f"   Total: {total_obligations}")

        # Obrigações por status
        from app.schemas.obligation import ObligationStatus
        for status in ObligationStatus:
            result = await session.execute(
                select(func.count()).select_from(Obligation).where(Obligation.status == status)
            )
            count = result.scalar()
            print(f"   - {status.value}: {count}")

        # Validar Licenças
        print("\n>> LICENCAS:")
        result = await session.execute(
            select(func.count()).select_from(License)
        )
        total_licenses = result.scalar()
        print(f"   Total: {total_licenses}")

        # Licenças por tipo
        from app.schemas.license import LicenseType
        for license_type in LicenseType:
            result = await session.execute(
                select(func.count()).select_from(License).where(License.license_type == license_type)
            )
            count = result.scalar()
            if count > 0:
                print(f"   - {license_type.value}: {count}")

        # Validar Transações Financeiras
        print("\n>> TRANSACOES FINANCEIRAS:")
        result = await session.execute(
            select(func.count()).select_from(FinancialTransaction)
        )
        total_transactions = result.scalar()
        print(f"   Total: {total_transactions}")

        # Transações por tipo
        from app.db.models.finance import TransactionType, PaymentStatus
        for trans_type in TransactionType:
            result = await session.execute(
                select(func.count()).select_from(FinancialTransaction).where(
                    FinancialTransaction.transaction_type == trans_type
                )
            )
            count = result.scalar()

            # Calcular total
            result = await session.execute(
                select(func.sum(FinancialTransaction.amount)).where(
                    FinancialTransaction.transaction_type == trans_type
                )
            )
            total = result.scalar() or 0

            print(f"   - {trans_type.value}: {count} (R$ {total:,.2f})")

        # Transações por status de pagamento
        print("\n   Status de Pagamento:")
        for status in PaymentStatus:
            result = await session.execute(
                select(func.count()).select_from(FinancialTransaction).where(
                    FinancialTransaction.payment_status == status
                )
            )
            count = result.scalar()
            if count > 0:
                print(f"   - {status.value}: {count}")

        # Exemplo de cliente completo
        print("\n>> EXEMPLO DE CLIENTE COMPLETO:")
        result = await session.execute(
            select(Client).limit(1)
        )
        client = result.scalar_one_or_none()

        if client:
            print(f"\n   Cliente: {client.razao_social}")

            # Obrigações do cliente
            result = await session.execute(
                select(func.count()).select_from(Obligation).where(
                    Obligation.client_id == client.id
                )
            )
            client_obligations = result.scalar()
            print(f"   Obrigacoes: {client_obligations}")

            # Licenças do cliente
            result = await session.execute(
                select(func.count()).select_from(License).where(
                    License.client_id == client.id
                )
            )
            client_licenses = result.scalar()
            print(f"   Licencas: {client_licenses}")

            # Transações do cliente
            result = await session.execute(
                select(func.count()).select_from(FinancialTransaction).where(
                    FinancialTransaction.client_id == client.id
                )
            )
            client_transactions = result.scalar()
            print(f"   Transacoes: {client_transactions}")

        print("\n" + "="*70)
        print("VALIDACAO CONCLUIDA COM SUCESSO!")
        print("="*70 + "\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(validate_seed())
