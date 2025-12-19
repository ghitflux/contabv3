"""
Seed obligation types using raw SQL (to avoid enum issues).
Run with: python -m scripts.seed_obligation_types_sql
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.db.session import get_session_context

# Define obligation types with raw SQL
OBLIGATION_TYPES_SQL = [
    ("DAS_MENSAL", "DAS - Documento de Arrecadacao do Simples Nacional", "mensal", 20, None, True, True, True, False, True, False, False),
    ("DEFIS_ANUAL", "DEFIS - Declaracao de Informacoes Socioeconomicas e Fiscais", "anual", 31, 3, True, True, True, False, True, False, False),
    ("DAS_MEI_MENSAL", "DAS MEI - Documento de Arrecadacao do MEI", "mensal", 20, None, False, False, False, True, False, False, False),
    ("DASN_SIMEI_ANUAL", "DASN-SIMEI - Declaracao Anual do Simples Nacional para MEI", "anual", 31, 5, False, False, False, True, False, False, False),
    ("DCTF_MENSAL", "DCTF - Declaracao de Debitos e Creditos Tributarios Federais", "mensal", 15, None, True, True, True, False, False, True, True),
    ("PIS_COFINS_MENSAL", "PIS/COFINS - Contribuicoes Sociais", "mensal", 25, None, True, True, True, False, False, True, True),
    ("EFD_CONTRIBUICOES", "EFD-Contribuicoes - Escrituracao Fiscal Digital", "mensal", 10, None, True, True, True, False, False, True, True),
    ("IRPJ_TRIMESTRAL", "IRPJ - Imposto de Renda Pessoa Juridica (Trimestral)", "trimestral", 31, None, True, True, True, False, False, True, False),
    ("CSLL_TRIMESTRAL", "CSLL - Contribuicao Social sobre o Lucro Liquido (Trimestral)", "trimestral", 31, None, True, True, True, False, False, True, False),
    ("IRPJ_MENSAL", "IRPJ - Imposto de Renda Pessoa Juridica (Mensal)", "mensal", 31, None, True, True, True, False, False, False, True),
    ("CSLL_MENSAL", "CSLL - Contribuicao Social sobre o Lucro Liquido (Mensal)", "mensal", 31, None, True, True, True, False, False, False, True),
    ("SPED_FISCAL", "SPED Fiscal - Escrituracao Fiscal Digital", "mensal", 20, None, True, False, True, False, False, True, True),
    ("GIA_MENSAL", "GIA - Guia de Informacao e Apuracao do ICMS", "mensal", 10, None, True, False, True, False, False, True, True),
    ("NFS_E_MENSAL", "NFS-e - Nota Fiscal de Servicos Eletronica", "mensal", 5, None, False, True, False, False, False, True, True),
    ("DMS_MENSAL", "DMS - Declaracao Mensal de Servicos", "mensal", 10, None, False, True, False, False, False, True, True),
    ("ESOCIAL_MENSAL", "eSocial - Sistema de Escrituracao Digital", "mensal", 15, None, True, True, True, False, True, True, True),
    ("FGTS_MENSAL", "FGTS - Fundo de Garantia do Tempo de Servico", "mensal", 7, None, True, True, True, True, True, True, True),
    ("CAGED_MENSAL", "CAGED - Cadastro Geral de Empregados e Desempregados", "mensal", 7, None, True, True, True, False, True, True, True),
    ("DIRPJ_ANUAL", "DIRPJ - Declaracao de Informacoes Economico-Fiscais da PJ", "anual", 31, 7, True, True, True, False, False, True, True),
    ("DIRF_ANUAL", "DIRF - Declaracao do Imposto de Renda Retido na Fonte", "anual", 28, 2, True, True, True, False, True, True, True),
    ("RAIS_ANUAL", "RAIS - Relacao Anual de Informacoes Sociais", "anual", 31, 3, True, True, True, False, True, True, True),
    ("IPI_MENSAL", "IPI - Imposto sobre Produtos Industrializados", "mensal", 25, None, False, False, True, False, False, True, True),
    ("BLOCO_K_MENSAL", "Bloco K - Controle de Estoque e Producao", "mensal", 20, None, False, False, True, False, False, True, True),
    ("LALUR_ANUAL", "LALUR - Livro de Apuracao do Lucro Real", "anual", 31, 12, True, True, True, False, False, False, True),
]


async def seed():
    """Seed using raw SQL."""
    try:
        async with get_session_context() as db:
            print("Seeding obligation types with SQL...")

            # Check how many exist
            result = await db.execute(text("SELECT count(*) FROM obligation_types"))
            existing_count = result.scalar()
            print(f"  Existing: {existing_count}")

            if existing_count > 0:
                print("  Obligation types already seeded. Skipping.")
                return

            # Insert all
            inserted = 0
            for code, name, recurrence, day, month, commerce, service, industry, mei, simples, presumido, real in OBLIGATION_TYPES_SQL:
                await db.execute(
                    text("""
                        INSERT INTO obligation_types (
                            id, code, name, recurrence, day_of_month, month_of_year,
                            applies_to_commerce, applies_to_service, applies_to_industry, applies_to_mei,
                            applies_to_simples, applies_to_presumido, applies_to_real, is_active
                        ) VALUES (
                            :id, :code, :name, :recurrence::obligationrecurrence, :day, :month,
                            :commerce, :service, :industry, :mei,
                            :simples, :presumido, :real, true
                        )
                    """),
                    {
                        "id": str(uuid4()),
                        "code": code,
                        "name": name,
                        "recurrence": recurrence,
                        "day": day,
                        "month": month,
                        "commerce": commerce,
                        "service": service,
                        "industry": industry,
                        "mei": mei,
                        "simples": simples,
                        "presumido": presumido,
                        "real": real,
                    }
                )
                inserted += 1
                print(f"  Created {code}")

            print(f"\nSeed complete! Created: {inserted}")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(seed())
