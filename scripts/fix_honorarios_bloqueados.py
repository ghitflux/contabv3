#!/usr/bin/env python3
"""
Script de correcao: remove bloqueios de monthly_fee_blocks e regenera honorarios.

Uso:
    # No container da API:
    python3 /tmp/fix_honorarios_bloqueados.py 2026-04-01

    # Via docker exec:
    docker cp fix_honorarios_bloqueados.py contabil-api-prod:/tmp/
    docker exec contabil-api-prod python3 /tmp/fix_honorarios_bloqueados.py 2026-04-01

Quando usar:
    Quando honorarios de um mes nao foram gerados porque alguem excluiu via interface
    e os bloqueios em monthly_fee_blocks impediram a regeneracao automatica.
"""
import asyncio
import sys
from datetime import date

sys.path.insert(0, "/app")

from app.db.session import get_session_context
from app.db.models.finance import MonthlyFeeBlock
from app.db.models.client import Client, ClientStatus
from app.services.finance.fee_generator_service import FeeGeneratorService
from app.core.config import settings
from sqlalchemy import select, delete


def parse_reference_month(arg: str) -> date:
    """Aceita YYYY-MM-01 ou YYYY-MM."""
    parts = arg.split("-")
    if len(parts) == 2:
        return date(int(parts[0]), int(parts[1]), 1)
    if len(parts) == 3:
        return date(int(parts[0]), int(parts[1]), 1)
    raise ValueError(f"Formato invalido: {arg}. Use YYYY-MM-01 ou YYYY-MM")


async def main(reference_month: date):
    print(f"Competencia alvo: {reference_month.strftime('%m/%Y')}")
    print("-" * 50)

    async with get_session_context() as db:
        # Passo 1: contar bloqueios existentes
        count_result = await db.execute(
            select(MonthlyFeeBlock).where(MonthlyFeeBlock.reference_month == reference_month)
        )
        blocks = count_result.scalars().all()
        print(f"Bloqueios encontrados: {len(blocks)}")

        if not blocks:
            print("Nenhum bloqueio para remover.")
        else:
            result = await db.execute(
                delete(MonthlyFeeBlock).where(MonthlyFeeBlock.reference_month == reference_month)
            )
            await db.commit()
            print(f"[OK] Bloqueios removidos: {result.rowcount}")

        # Passo 2: buscar clientes elegiveis
        stmt = select(Client).where(
            Client.status == ClientStatus.ATIVO,
            Client.gerar_lancamentos_honorarios == True,
            Client.id != settings.OFFICE_CLIENT_ID,
        )
        clients_result = await db.execute(stmt)
        clients = clients_result.scalars().all()
        print(f"Clientes elegiveis: {len(clients)}")
        print("-" * 50)

        # Passo 3: gerar honorarios para cada cliente
        service = FeeGeneratorService(db)
        generated = 0
        skipped = 0
        errors = 0

        for client in clients:
            try:
                txs = await service._generate_for_client(
                    client=client,
                    reference_month=reference_month,
                    generated_by_id=None,
                )
                await db.commit()
                if txs:
                    generated += 1
                    print(f"  [+] {client.razao_social}: {len(txs)} lancamento(s)")
                else:
                    skipped += 1
                    print(f"  [=] {client.razao_social}: ja existe ou sem fee configurado")
            except Exception as e:
                errors += 1
                await db.rollback()
                print(f"  [!] {client.razao_social}: ERRO - {e}")

        print("-" * 50)
        print(f"Gerados:  {generated}")
        print(f"Pulados:  {skipped}")
        print(f"Erros:    {errors}")
        print(f"Total lancamentos novos: {generated * 2} (par cliente + escritorio)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Uso: python3 {sys.argv[0]} YYYY-MM")
        print(f"Exemplo: python3 {sys.argv[0]} 2026-05")
        sys.exit(1)

    ref_month = parse_reference_month(sys.argv[1])
    asyncio.run(main(ref_month))
