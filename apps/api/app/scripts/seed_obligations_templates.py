"""
Seed script for populating obligations_templates table with default data.
"""

import asyncio
from uuid import uuid4

from sqlalchemy import select

from app.db.models.client import RegimeTributario
from app.db.models.obligation_template import (
    ObligationPeriodicidade,
    ObligationTemplate,
    ServicoContratado,
)
from app.db.session import get_session_context


OBLIGATION_TEMPLATES = [
    # ========== SIMPLES NACIONAL - FISCAL ==========
    {
        "nome": "PGDAS-D",
        "descricao": "Programa Gerador do Documento de Arrecadação do Simples Nacional - Declaratório",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    {
        "nome": "DEFIS",
        "descricao": "Declaração de Informações Socioeconômicas e Fiscais",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "fiscal",
        "periodicidade": "anual",
    },
    {
        "nome": "GIA",
        "descricao": "Guia de Informação e Apuração do ICMS (quando aplicável)",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    # ========== SIMPLES NACIONAL - CONTÁBIL ==========
    {
        "nome": "Conciliações",
        "descricao": "Conciliações bancárias e contábeis",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "contabil",
        "periodicidade": "mensal",
    },
    {
        "nome": "Lançamentos contábeis",
        "descricao": "Registro de lançamentos contábeis mensais",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "contabil",
        "periodicidade": "mensal",
    },
    # ========== SIMPLES NACIONAL - PESSOAL ==========
    {
        "nome": "eSocial/FGTS",
        "descricao": "Sistema de Escrituração Digital das Obrigações Fiscais, Previdenciárias e Trabalhistas",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "pessoal",
        "periodicidade": "mensal",
    },
    {
        "nome": "RAIS",
        "descricao": "Relação Anual de Informações Sociais",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "pessoal",
        "periodicidade": "anual",
    },
    {
        "nome": "DCTFWeb",
        "descricao": "Declaração de Débitos e Créditos Tributários Federais",
        "regime_tributario": "simples_nacional",
        "servico_contratado": "pessoal",
        "periodicidade": "mensal",
    },
    # ========== LUCRO PRESUMIDO - FISCAL ==========
    {
        "nome": "EFD-Contribuições",
        "descricao": "Escrituração Fiscal Digital das Contribuições (PIS/COFINS)",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    {
        "nome": "DCTF",
        "descricao": "Declaração de Débitos e Créditos Tributários Federais",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    {
        "nome": "ECF",
        "descricao": "Escrituração Contábil Fiscal",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "fiscal",
        "periodicidade": "anual",
    },
    {
        "nome": "GIA",
        "descricao": "Guia de Informação e Apuração do ICMS",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    # ========== LUCRO PRESUMIDO - CONTÁBIL ==========
    {
        "nome": "ECD",
        "descricao": "Escrituração Contábil Digital",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "contabil",
        "periodicidade": "anual",
    },
    {
        "nome": "Conciliações",
        "descricao": "Conciliações bancárias e contábeis",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "contabil",
        "periodicidade": "mensal",
    },
    # ========== LUCRO PRESUMIDO - PESSOAL ==========
    {
        "nome": "eSocial/FGTS",
        "descricao": "Sistema de Escrituração Digital das Obrigações Fiscais, Previdenciárias e Trabalhistas",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "pessoal",
        "periodicidade": "mensal",
    },
    {
        "nome": "RAIS",
        "descricao": "Relação Anual de Informações Sociais",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "pessoal",
        "periodicidade": "anual",
    },
    {
        "nome": "DIRF",
        "descricao": "Declaração do Imposto de Renda Retido na Fonte",
        "regime_tributario": "lucro_presumido",
        "servico_contratado": "pessoal",
        "periodicidade": "anual",
    },
    # ========== LUCRO REAL - FISCAL ==========
    {
        "nome": "EFD-Contribuições",
        "descricao": "Escrituração Fiscal Digital das Contribuições (PIS/COFINS)",
        "regime_tributario": "lucro_real",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    {
        "nome": "DCTF",
        "descricao": "Declaração de Débitos e Créditos Tributários Federais",
        "regime_tributario": "lucro_real",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    {
        "nome": "ECF",
        "descricao": "Escrituração Contábil Fiscal",
        "regime_tributario": "lucro_real",
        "servico_contratado": "fiscal",
        "periodicidade": "anual",
    },
    {
        "nome": "LALUR",
        "descricao": "Livro de Apuração do Lucro Real",
        "regime_tributario": "lucro_real",
        "servico_contratado": "fiscal",
        "periodicidade": "anual",
    },
    # ========== LUCRO REAL - CONTÁBIL ==========
    {
        "nome": "ECD",
        "descricao": "Escrituração Contábil Digital",
        "regime_tributario": "lucro_real",
        "servico_contratado": "contabil",
        "periodicidade": "anual",
    },
    {
        "nome": "Conciliações",
        "descricao": "Conciliações bancárias e contábeis",
        "regime_tributario": "lucro_real",
        "servico_contratado": "contabil",
        "periodicidade": "mensal",
    },
    # ========== LUCRO REAL - PESSOAL ==========
    {
        "nome": "eSocial/FGTS",
        "descricao": "Sistema de Escrituração Digital das Obrigações Fiscais, Previdenciárias e Trabalhistas",
        "regime_tributario": "lucro_real",
        "servico_contratado": "pessoal",
        "periodicidade": "mensal",
    },
    {
        "nome": "RAIS",
        "descricao": "Relação Anual de Informações Sociais",
        "regime_tributario": "lucro_real",
        "servico_contratado": "pessoal",
        "periodicidade": "anual",
    },
    {
        "nome": "DIRF",
        "descricao": "Declaração do Imposto de Renda Retido na Fonte",
        "regime_tributario": "lucro_real",
        "servico_contratado": "pessoal",
        "periodicidade": "anual",
    },
    # ========== MEI - FISCAL ==========
    {
        "nome": "DAS-MEI",
        "descricao": "Documento de Arrecadação do Simples Nacional - MEI",
        "regime_tributario": "mei",
        "servico_contratado": "fiscal",
        "periodicidade": "mensal",
    },
    {
        "nome": "DASN-SIMEI",
        "descricao": "Declaração Anual do Simples Nacional - MEI",
        "regime_tributario": "mei",
        "servico_contratado": "fiscal",
        "periodicidade": "anual",
    },
    # ========== MEI - CONTÁBIL ==========
    {
        "nome": "Relatório Mensal",
        "descricao": "Relatório Mensal de Receitas Brutas",
        "regime_tributario": "mei",
        "servico_contratado": "contabil",
        "periodicidade": "mensal",
    },
    # ========== MEI - PESSOAL ==========
    {
        "nome": "eSocial",
        "descricao": "eSocial simplificado para MEI (se tiver funcionário)",
        "regime_tributario": "mei",
        "servico_contratado": "pessoal",
        "periodicidade": "mensal",
    },
]


async def seed_obligations():
    """Seed obligations templates table."""

    async with get_session_context() as session:
        # Check if already seeded
        result = await session.execute(select(ObligationTemplate).limit(1))
        if result.scalars().first():
            print("[OK] Obligations templates already seeded. Skipping...")
            return

        print(f"[*] Creating {len(OBLIGATION_TEMPLATES)} obligation templates...")

        # Create all templates
        for template_data in OBLIGATION_TEMPLATES:
            template = ObligationTemplate(**template_data)
            session.add(template)

        print(f"[OK] Successfully created {len(OBLIGATION_TEMPLATES)} obligation templates!")


async def main():
    """Main function."""
    print("\n" + "="*50)
    print("Seeding Obligations Templates")
    print("="*50 + "\n")

    try:
        await seed_obligations()
        print("\n[OK] Seed completed successfully!\n")
    except Exception as e:
        print(f"\n[ERROR] Error seeding: {e}\n")
        raise


if __name__ == "__main__":
    asyncio.run(main())
