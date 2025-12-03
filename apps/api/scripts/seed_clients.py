"""
Script to seed clients.
"""

import asyncio
import sys
from pathlib import Path
from datetime import date

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa

settings = get_settings()


async def seed_clients():
    """Seed clients."""
    DATABASE_URL = str(settings.DATABASE_URL)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if clients already exist
        from sqlalchemy import select, func
        result = await session.execute(select(func.count()).select_from(Client))
        count = result.scalar()

        if count and count >= 15:  # We'll create 15 clients
            print(f"Found {count} existing clients. Skipping seed.")
            await engine.dispose()
            return

        # Sample clients based on the image
        clients_data = [
            {
                "razao_social": "Tech Solutions Ltda",
                "nome_fantasia": "Tech Solutions",
                "cnpj": "12.345.678/0001-90",
                "cpf_empresa": "123.456.789-01",
                "email": "contato@techsolutions.com.br",
                "telefone": "(11) 3456-7890",
                "celular": "(11) 98765-4321",
                "cep": "01310-100",
                "logradouro": "Av. Paulista",
                "numero": "1000",
                "bairro": "Bela Vista",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": 1500.00,
                "dia_vencimento": 10,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "regime_tributario": RegimeTributario.LUCRO_PRESUMIDO,
                "tipo_empresa": TipoEmpresa.SERVICO,
                "status": ClientStatus.ATIVO,
                "data_abertura": date(2020, 1, 15),
                "senha_gov": "SenhaGov@2024",
                "login_seg_desemp": "tech.solutions",
                "senha_seg_desemp": "SegDesemp#456",
                "email_seg_desemp": "rh@techsolutions.com.br",
                "senha_nfse": "NfSe$2024",
                "senha_certificado_digital": "CertDigital!789",
            },
            {
                "razao_social": "Comércio ABC S.A.",
                "nome_fantasia": "ABC Comércio",
                "cnpj": "98.765.432/0001-10",
                "cpf_empresa": "987.654.321-00",
                "email": "contato@abccomercio.com.br",
                "telefone": "(21) 2345-6789",
                "celular": "(21) 99876-5432",
                "cep": "20040-020",
                "logradouro": "Rua do Ouvidor",
                "numero": "50",
                "bairro": "Centro",
                "cidade": "Rio de Janeiro",
                "uf": "RJ",
                "honorarios_mensais": 2000.00,
                "dia_vencimento": 15,
                "servicos_contratados": ["fiscal", "contabil"],
                "regime_tributario": RegimeTributario.SIMPLES_NACIONAL,
                "tipo_empresa": TipoEmpresa.COMERCIO,
                "status": ClientStatus.ATIVO,
                "data_abertura": date(2019, 5, 20),
                "senha_gov": "GovABC@2024",
                "login_seg_desemp": "abc.comercio",
                "senha_seg_desemp": "AbcSeg#123",
                "email_seg_desemp": "rh@abccomercio.com.br",
                "senha_nfse": "NfseABC$456",
                "senha_certificado_digital": "CertABC!789",
            },
            {
                "razao_social": "Indústria XYZ Ltda",
                "nome_fantasia": "XYZ Indústria",
                "cnpj": "11.222.333/0001-44",
                "cpf_empresa": "111.222.333-44",
                "email": "contato@xyzindustria.com.br",
                "telefone": "(47) 3456-7890",
                "celular": "(47) 98765-4321",
                "cep": "89010-001",
                "logradouro": "Rua XV de Novembro",
                "numero": "1234",
                "bairro": "Centro",
                "cidade": "Blumenau",
                "uf": "SC",
                "honorarios_mensais": 3000.00,
                "dia_vencimento": 5,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "regime_tributario": RegimeTributario.LUCRO_REAL,
                "tipo_empresa": TipoEmpresa.INDUSTRIA,
                "status": ClientStatus.ATIVO,
                "data_abertura": date(2018, 3, 10),
                "senha_gov": "XyzGov@2024",
                "login_seg_desemp": "xyz.industria",
                "senha_seg_desemp": "XyzSeg#789",
                "email_seg_desemp": "rh@xyzindustria.com.br",
                "senha_nfse": "NfseXYZ$2024",
                "senha_certificado_digital": "CertXYZ!456",
            },
        ]

        # Add more sample clients
        for i in range(4, 15):
            clients_data.append({
                "razao_social": f"Empresa {chr(64 + i)} Ltda",
                "nome_fantasia": f"Empresa {chr(64 + i)}",
                "cnpj": f"{i:02d}.{i+10:03d}.{i+20:03d}/0001-{i+30:02d}",
                "cpf_empresa": f"{i:03d}.{i+100:03d}.{i+200:03d}-{i+10:02d}",
                "email": f"contato@empresa{chr(96+i)}.com.br",
                "telefone": f"(11) {3000+i}-{7000+i}",
                "honorarios_mensais": 1000.00 + (i * 100),
                "dia_vencimento": (i % 28) + 1,
                "servicos_contratados": ["fiscal", "contabil"],
                "regime_tributario": RegimeTributario.SIMPLES_NACIONAL if i % 2 == 0 else RegimeTributario.LUCRO_PRESUMIDO,
                "tipo_empresa": TipoEmpresa.COMERCIO if i % 3 == 0 else TipoEmpresa.SERVICO,
                "status": ClientStatus.ATIVO,
                "data_abertura": date(2020 + (i % 3), (i % 12) + 1, (i % 28) + 1),
                "senha_gov": f"Gov{chr(64+i)}@{2020+i}",
                "login_seg_desemp": f"empresa.{chr(96+i)}",
                "senha_seg_desemp": f"SegDesemp{chr(64+i)}#{i}00",
                "email_seg_desemp": f"rh@empresa{chr(96+i)}.com.br",
                "senha_nfse": f"Nfse{chr(64+i)}${2020+i}",
                "senha_certificado_digital": f"Cert{chr(64+i)}!{i}00",
            })

        for client_data in clients_data:
            client = Client(**client_data)
            session.add(client)

        await session.commit()
        print(f"Created {len(clients_data)} clients")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_clients())

