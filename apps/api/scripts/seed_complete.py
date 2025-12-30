"""
Script completo de seed para popular o banco de dados com dados de teste.
Cria clientes de todos os tipos com obrigações, licenças e transações financeiras.
"""

import asyncio
import sys
from pathlib import Path
from datetime import date, datetime, timedelta
from decimal import Decimal
from random import choice, randint, uniform
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from app.core.config import get_settings
from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa
from app.db.models.finance import FinancialTransaction, TransactionType, PaymentMethod, PaymentStatus
from app.db.models.obligation import Obligation
from app.db.models.obligation_type import ObligationType
from app.db.models.license import License
from app.schemas.obligation import ObligationStatus, ObligationPriority
from app.schemas.license import LicenseType, LicenseStatus

settings = get_settings()


def generate_cnpj(base_number: int) -> str:
    """Generate a unique CNPJ."""
    return f"{base_number:02d}.{base_number+100:03d}.{base_number+200:03d}/0001-{base_number:02d}"


def generate_cpf(base_number: int) -> str:
    """Generate a unique CPF."""
    return f"{base_number:03d}.{base_number+100:03d}.{base_number+200:03d}-{base_number:02d}"


async def get_first_user(session: AsyncSession):
    """Get the first user for assigning transactions."""
    from app.db.models.user import User
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise Exception("Nenhum usuário encontrado. Execute seed_users.py primeiro.")
    return user


async def seed_complete():
    """Seed completo do banco de dados."""
    print(">> Iniciando seed completo do banco de dados...")

    DATABASE_URL = str(settings.DATABASE_URL)
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get first user for transactions
        user = await get_first_user(session)
        print(f"OK - Usuario encontrado: {user.name}")

        # ====================================================================
        # 1. LIMPAR DADOS EXISTENTES (opcional - comentar se quiser manter)
        # ====================================================================
        print("\n>> Limpando dados existentes...")
        await session.execute(delete(FinancialTransaction))
        await session.execute(delete(Obligation))
        await session.execute(delete(License))
        await session.execute(delete(Client))
        await session.commit()
        print("OK - Dados limpos")

        # ====================================================================
        # 2. CRIAR CLIENTES DE TODOS OS TIPOS
        # ====================================================================
        print("\n>> Criando clientes...")

        clients_data = [
            # ========== SIMPLES NACIONAL ==========
            {
                "razao_social": "Mercado São Pedro Ltda",
                "nome_fantasia": "Mercado São Pedro",
                "regime_tributario": RegimeTributario.SIMPLES_NACIONAL,
                "tipo_empresa": TipoEmpresa.COMERCIO,
                "cnpj": "10.234.567/0001-10",
                "inscricao_estadual": "123.456.789.110",
                "inscricao_municipal": "45678901",
                "email": "contato@mercadosaopedro.com.br",
                "telefone": "(11) 3234-5678",
                "celular": "(11) 98765-4321",
                "cep": "01310-100",
                "logradouro": "Av. Paulista",
                "numero": "1500",
                "bairro": "Bela Vista",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("1800.00"),
                "dia_vencimento": 10,
                "servicos_contratados": ["fiscal", "contabil"],
                "codigo_simples": "1234567890",
                "data_abertura": date(2018, 3, 15),
                "inicio_escritorio": date(2018, 4, 1),
                "responsavel_nome": "João Silva",
                "responsavel_cpf": "123.456.789-00",
                "responsavel_email": "joao@mercadosaopedro.com.br",
                "responsavel_telefone": "(11) 98765-4321",
                "cpf_empresa": "123.456.789-00",
                "senha_gov": "GovMercado@2024",
                "senha_prefeitura": "PrefMercado#123",
                "login_seg_desemp": "mercado.saopedro",
                "senha_seg_desemp": "SegDesemp@456",
                "email_seg_desemp": "rh@mercadosaopedro.com.br",
                "senha_nfse": "NfSe$2024",
                "senha_certificado_digital": "CertDigital!789",
                "observacoes": "Cliente ativo desde 2018, sempre em dia com pagamentos.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Padaria Pão Quentinho Ltda",
                "nome_fantasia": "Pão Quentinho",
                "regime_tributario": RegimeTributario.SIMPLES_NACIONAL,
                "tipo_empresa": TipoEmpresa.COMERCIO,
                "cnpj": "11.345.678/0001-21",
                "inscricao_estadual": "234.567.890.221",
                "inscricao_municipal": "56789012",
                "email": "contato@paoquentinho.com.br",
                "telefone": "(11) 3345-6789",
                "celular": "(11) 99876-5432",
                "cep": "04012-001",
                "logradouro": "Rua da Consolação",
                "numero": "234",
                "bairro": "Consolação",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("1200.00"),
                "dia_vencimento": 15,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "codigo_simples": "2345678901",
                "data_abertura": date(2019, 6, 10),
                "inicio_escritorio": date(2019, 7, 1),
                "responsavel_nome": "Maria Santos",
                "responsavel_cpf": "234.567.890-11",
                "responsavel_email": "maria@paoquentinho.com.br",
                "responsavel_telefone": "(11) 99876-5432",
                "cpf_empresa": "234.567.890-11",
                "senha_gov": "GovPao@2024",
                "senha_prefeitura": "PrefPao#234",
                "login_seg_desemp": "pao.quentinho",
                "senha_seg_desemp": "SegDesemp@567",
                "email_seg_desemp": "rh@paoquentinho.com.br",
                "senha_nfse": "NfSe$2024Pao",
                "senha_certificado_digital": "CertDigital!890",
                "observacoes": "Padaria familiar, 3 funcionários.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Consultoria Tech Solutions Ltda",
                "nome_fantasia": "Tech Solutions",
                "regime_tributario": RegimeTributario.SIMPLES_NACIONAL,
                "tipo_empresa": TipoEmpresa.SERVICO,
                "cnpj": "12.456.789/0001-32",
                "inscricao_municipal": "67890123",
                "email": "contato@techsolutions.com.br",
                "telefone": "(11) 3456-7890",
                "celular": "(11) 97654-3210",
                "cep": "04543-000",
                "logradouro": "Av. Brigadeiro Faria Lima",
                "numero": "3000",
                "bairro": "Itaim Bibi",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("2500.00"),
                "dia_vencimento": 5,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "codigo_simples": "3456789012",
                "data_abertura": date(2020, 1, 20),
                "inicio_escritorio": date(2020, 2, 1),
                "responsavel_nome": "Carlos Tech",
                "responsavel_cpf": "345.678.901-22",
                "responsavel_email": "carlos@techsolutions.com.br",
                "responsavel_telefone": "(11) 97654-3210",
                "cpf_empresa": "345.678.901-22",
                "senha_gov": "GovTech@2024",
                "senha_prefeitura": "PrefTech#345",
                "login_seg_desemp": "tech.solutions",
                "senha_seg_desemp": "SegDesemp@678",
                "email_seg_desemp": "rh@techsolutions.com.br",
                "senha_nfse": "NfSe$2024Tech",
                "senha_certificado_digital": "CertDigital!901",
                "observacoes": "Consultoria de TI, 5 consultores.",
                "status": ClientStatus.ATIVO,
            },

            # ========== LUCRO PRESUMIDO ==========
            {
                "razao_social": "Indústria de Móveis Madeira Nobre S.A.",
                "nome_fantasia": "Madeira Nobre",
                "regime_tributario": RegimeTributario.LUCRO_PRESUMIDO,
                "tipo_empresa": TipoEmpresa.INDUSTRIA,
                "cnpj": "13.567.890/0001-43",
                "inscricao_estadual": "345.678.901.332",
                "inscricao_municipal": "78901234",
                "email": "contato@madeiranobre.com.br",
                "telefone": "(47) 3567-8901",
                "celular": "(47) 98543-2109",
                "cep": "89010-001",
                "logradouro": "Rua XV de Novembro",
                "numero": "1234",
                "bairro": "Centro",
                "cidade": "Blumenau",
                "uf": "SC",
                "honorarios_mensais": Decimal("4500.00"),
                "dia_vencimento": 20,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "data_abertura": date(2015, 8, 5),
                "inicio_escritorio": date(2015, 9, 1),
                "responsavel_nome": "Pedro Madeira",
                "responsavel_cpf": "456.789.012-33",
                "responsavel_email": "pedro@madeiranobre.com.br",
                "responsavel_telefone": "(47) 98543-2109",
                "cpf_empresa": "456.789.012-33",
                "senha_gov": "GovMadeira@2024",
                "senha_prefeitura": "PrefMadeira#456",
                "login_seg_desemp": "madeira.nobre",
                "senha_seg_desemp": "SegDesemp@789",
                "email_seg_desemp": "rh@madeiranobre.com.br",
                "senha_nfse": "NfSe$2024Madeira",
                "senha_certificado_digital": "CertDigital!012",
                "observacoes": "Indústria de móveis planejados, 25 funcionários.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Atacado Distribuidora Central Ltda",
                "nome_fantasia": "Distribuidora Central",
                "regime_tributario": RegimeTributario.LUCRO_PRESUMIDO,
                "tipo_empresa": TipoEmpresa.COMERCIO,
                "cnpj": "14.678.901/0001-54",
                "inscricao_estadual": "456.789.012.443",
                "inscricao_municipal": "89012345",
                "email": "contato@distcentral.com.br",
                "telefone": "(21) 2678-9012",
                "celular": "(21) 99432-1098",
                "cep": "20040-020",
                "logradouro": "Rua do Ouvidor",
                "numero": "500",
                "bairro": "Centro",
                "cidade": "Rio de Janeiro",
                "uf": "RJ",
                "honorarios_mensais": Decimal("3800.00"),
                "dia_vencimento": 25,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "data_abertura": date(2016, 4, 12),
                "inicio_escritorio": date(2016, 5, 1),
                "responsavel_nome": "Ana Distribuidora",
                "responsavel_cpf": "567.890.123-44",
                "responsavel_email": "ana@distcentral.com.br",
                "responsavel_telefone": "(21) 99432-1098",
                "cpf_empresa": "567.890.123-44",
                "senha_gov": "GovDist@2024",
                "senha_prefeitura": "PrefDist#567",
                "login_seg_desemp": "dist.central",
                "senha_seg_desemp": "SegDesemp@890",
                "email_seg_desemp": "rh@distcentral.com.br",
                "senha_nfse": "NfSe$2024Dist",
                "senha_certificado_digital": "CertDigital!123",
                "observacoes": "Atacado de alimentos, 15 funcionários.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Escritório de Advocacia Silva & Associados",
                "nome_fantasia": "Silva Advogados",
                "regime_tributario": RegimeTributario.LUCRO_PRESUMIDO,
                "tipo_empresa": TipoEmpresa.SERVICO,
                "cnpj": "15.789.012/0001-65",
                "inscricao_municipal": "90123456",
                "email": "contato@silvaadvogados.com.br",
                "telefone": "(11) 3789-0123",
                "celular": "(11) 98321-0987",
                "cep": "01451-000",
                "logradouro": "Av. Rebouças",
                "numero": "3970",
                "bairro": "Pinheiros",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("5200.00"),
                "dia_vencimento": 30,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "data_abertura": date(2012, 11, 8),
                "inicio_escritorio": date(2012, 12, 1),
                "responsavel_nome": "Dr. Roberto Silva",
                "responsavel_cpf": "678.901.234-55",
                "responsavel_email": "roberto@silvaadvogados.com.br",
                "responsavel_telefone": "(11) 98321-0987",
                "cpf_empresa": "678.901.234-55",
                "senha_gov": "GovAdv@2024",
                "senha_prefeitura": "PrefAdv#678",
                "login_seg_desemp": "silva.advogados",
                "senha_seg_desemp": "SegDesemp@901",
                "email_seg_desemp": "rh@silvaadvogados.com.br",
                "senha_nfse": "NfSe$2024Adv",
                "senha_certificado_digital": "CertDigital!234",
                "observacoes": "Escritório de advocacia, 8 advogados.",
                "status": ClientStatus.ATIVO,
            },

            # ========== LUCRO REAL ==========
            {
                "razao_social": "Construtora Edificar S.A.",
                "nome_fantasia": "Edificar Construções",
                "regime_tributario": RegimeTributario.LUCRO_REAL,
                "tipo_empresa": TipoEmpresa.INDUSTRIA,
                "cnpj": "16.890.123/0001-76",
                "inscricao_estadual": "567.890.123.554",
                "inscricao_municipal": "01234567",
                "email": "contato@edificar.com.br",
                "telefone": "(11) 3890-1234",
                "celular": "(11) 99210-9876",
                "cep": "04567-000",
                "logradouro": "Av. Eng. Luís Carlos Berrini",
                "numero": "1500",
                "bairro": "Brooklin",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("8500.00"),
                "dia_vencimento": 10,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "data_abertura": date(2010, 2, 15),
                "inicio_escritorio": date(2010, 3, 1),
                "responsavel_nome": "Eng. Fernando Construtor",
                "responsavel_cpf": "789.012.345-66",
                "responsavel_email": "fernando@edificar.com.br",
                "responsavel_telefone": "(11) 99210-9876",
                "cpf_empresa": "789.012.345-66",
                "senha_gov": "GovEdificar@2024",
                "senha_prefeitura": "PrefEdificar#789",
                "login_seg_desemp": "edificar.construcoes",
                "senha_seg_desemp": "SegDesemp@012",
                "email_seg_desemp": "rh@edificar.com.br",
                "senha_nfse": "NfSe$2024Edificar",
                "senha_certificado_digital": "CertDigital!345",
                "observacoes": "Construtora de grande porte, 120 funcionários.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Hospital Santa Casa da Saúde S.A.",
                "nome_fantasia": "Santa Casa",
                "regime_tributario": RegimeTributario.LUCRO_REAL,
                "tipo_empresa": TipoEmpresa.SERVICO,
                "cnpj": "17.901.234/0001-87",
                "inscricao_municipal": "12345678",
                "email": "contato@santacasa.com.br",
                "telefone": "(11) 3901-2345",
                "celular": "(11) 99109-8765",
                "cep": "01311-000",
                "logradouro": "Av. Paulista",
                "numero": "2000",
                "bairro": "Bela Vista",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("12000.00"),
                "dia_vencimento": 15,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "data_abertura": date(2005, 5, 20),
                "inicio_escritorio": date(2005, 6, 1),
                "responsavel_nome": "Dr. Marcos Saúde",
                "responsavel_cpf": "890.123.456-77",
                "responsavel_email": "marcos@santacasa.com.br",
                "responsavel_telefone": "(11) 99109-8765",
                "cpf_empresa": "890.123.456-77",
                "senha_gov": "GovSaude@2024",
                "senha_prefeitura": "PrefSaude#890",
                "login_seg_desemp": "santa.casa",
                "senha_seg_desemp": "SegDesemp@123",
                "email_seg_desemp": "rh@santacasa.com.br",
                "senha_nfse": "NfSe$2024Saude",
                "senha_certificado_digital": "CertDigital!456",
                "observacoes": "Hospital com 200 leitos, 350 funcionários.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Banco de Investimentos Capital S.A.",
                "nome_fantasia": "Capital Investimentos",
                "regime_tributario": RegimeTributario.LUCRO_REAL,
                "tipo_empresa": TipoEmpresa.FINANCEIRO,
                "cnpj": "18.012.345/0001-98",
                "email": "contato@capitalinvest.com.br",
                "telefone": "(11) 3012-3456",
                "celular": "(11) 98098-7654",
                "cep": "04578-000",
                "logradouro": "Av. Brigadeiro Faria Lima",
                "numero": "4500",
                "bairro": "Itaim Bibi",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("15000.00"),
                "dia_vencimento": 20,
                "servicos_contratados": ["fiscal", "contabil", "pessoal"],
                "data_abertura": date(2008, 9, 10),
                "inicio_escritorio": date(2008, 10, 1),
                "responsavel_nome": "Luiz Capital",
                "responsavel_cpf": "901.234.567-88",
                "responsavel_email": "luiz@capitalinvest.com.br",
                "responsavel_telefone": "(11) 98098-7654",
                "cpf_empresa": "901.234.567-88",
                "senha_gov": "GovCapital@2024",
                "senha_prefeitura": "PrefCapital#901",
                "login_seg_desemp": "capital.invest",
                "senha_seg_desemp": "SegDesemp@234",
                "email_seg_desemp": "rh@capitalinvest.com.br",
                "senha_nfse": "NfSe$2024Capital",
                "senha_certificado_digital": "CertDigital!567",
                "observacoes": "Instituição financeira, 80 funcionários.",
                "status": ClientStatus.ATIVO,
            },

            # ========== MEI ==========
            {
                "razao_social": "João da Silva - MEI",
                "nome_fantasia": "João Eletricista",
                "regime_tributario": RegimeTributario.MEI,
                "tipo_empresa": TipoEmpresa.SERVICO,
                "cnpj": "19.123.456/0001-09",
                "email": "joao.eletricista@gmail.com",
                "telefone": "(11) 3123-4567",
                "celular": "(11) 97987-6543",
                "cep": "02012-000",
                "logradouro": "Rua Voluntários da Pátria",
                "numero": "123",
                "bairro": "Santana",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("300.00"),
                "dia_vencimento": 10,
                "servicos_contratados": ["fiscal"],
                "codigo_simples": "4567890123",
                "data_abertura": date(2021, 3, 5),
                "inicio_escritorio": date(2021, 3, 5),
                "responsavel_nome": "João da Silva",
                "responsavel_cpf": "012.345.678-99",
                "responsavel_email": "joao.eletricista@gmail.com",
                "responsavel_telefone": "(11) 97987-6543",
                "cpf_empresa": "012.345.678-99",
                "senha_gov": "GovJoao@2024",
                "observacoes": "MEI - Eletricista autônomo.",
                "status": ClientStatus.ATIVO,
            },
            {
                "razao_social": "Maria dos Santos - MEI",
                "nome_fantasia": "Maria Costureira",
                "regime_tributario": RegimeTributario.MEI,
                "tipo_empresa": TipoEmpresa.SERVICO,
                "cnpj": "20.234.567/0001-10",
                "email": "maria.costura@gmail.com",
                "telefone": "(11) 3234-5678",
                "celular": "(11) 96876-5432",
                "cep": "03012-000",
                "logradouro": "Av. Celso Garcia",
                "numero": "456",
                "bairro": "Tatuapé",
                "cidade": "São Paulo",
                "uf": "SP",
                "honorarios_mensais": Decimal("250.00"),
                "dia_vencimento": 5,
                "servicos_contratados": ["fiscal"],
                "codigo_simples": "5678901234",
                "data_abertura": date(2022, 1, 10),
                "inicio_escritorio": date(2022, 1, 10),
                "responsavel_nome": "Maria dos Santos",
                "responsavel_cpf": "123.456.789-00",
                "responsavel_email": "maria.costura@gmail.com",
                "responsavel_telefone": "(11) 96876-5432",
                "cpf_empresa": "123.456.789-00",
                "senha_gov": "GovMaria@2024",
                "observacoes": "MEI - Costureira autônoma.",
                "status": ClientStatus.ATIVO,
            },
        ]

        # Criar clientes
        clients = []
        for client_data in clients_data:
            client = Client(**client_data)
            session.add(client)
            clients.append(client)

        await session.commit()
        print(f"OK - Criados {len(clients)} clientes")

        # Refresh clients to get IDs
        for client in clients:
            await session.refresh(client)

        # ====================================================================
        # 3. CRIAR OBRIGAÇÕES
        # ====================================================================
        print("\n>> Criando obrigacoes...")

        # Buscar tipos de obrigações
        result = await session.execute(select(ObligationType).where(ObligationType.is_active == True))
        obligation_types = result.scalars().all()

        if not obligation_types:
            print("AVISO - Nenhum tipo de obrigacao encontrado. Execute seed_obligation_types.py primeiro.")
        else:
            obligations = []
            current_date = date.today()

            for client in clients:
                # Filtrar tipos de obrigações aplicáveis ao cliente
                applicable_types = [
                    ot for ot in obligation_types
                    if ot.applies_to_client(client)
                ]

                # Criar obrigações para os próximos 3 meses
                for month_offset in range(3):
                    for obl_type in applicable_types:
                        # Calcular data de vencimento
                        target_month = current_date.month + month_offset
                        target_year = current_date.year
                        if target_month > 12:
                            target_month -= 12
                            target_year += 1

                        day = min(obl_type.day_of_month or 20, 28)  # Evitar datas inválidas
                        due_date = date(target_year, target_month, day)

                        # Determinar status baseado na data
                        if due_date < current_date:
                            status = ObligationStatus.ATRASADA
                            priority = ObligationPriority.URGENTE
                        elif due_date < current_date + timedelta(days=7):
                            status = choice([ObligationStatus.PENDENTE, ObligationStatus.EM_ANDAMENTO])
                            priority = ObligationPriority.ALTA
                        else:
                            status = ObligationStatus.PENDENTE
                            priority = ObligationPriority.MEDIA

                        # Algumas obrigações já concluídas
                        if month_offset == 0 and randint(1, 100) <= 60:  # 60% concluídas no mês atual
                            status = ObligationStatus.CONCLUIDA
                            completed_at = datetime.now() - timedelta(days=randint(1, 10))
                            completed_by = user.id
                        else:
                            completed_at = None
                            completed_by = None

                        obligation = Obligation(
                            client_id=client.id,
                            obligation_type_id=obl_type.id,
                            due_date=due_date,
                            status=status,
                            priority=priority,
                            description=f"{obl_type.name} - {client.nome_fantasia or client.razao_social}",
                            completed_at=completed_at,
                            completed_by=completed_by,
                        )
                        session.add(obligation)
                        obligations.append(obligation)

            await session.commit()
            print(f"OK - Criadas {len(obligations)} obrigacoes")

        # ====================================================================
        # 4. CRIAR LICENÇAS
        # ====================================================================
        print("\n>> Criando licencas...")

        licenses = []
        license_configs = [
            {
                "type": LicenseType.ALVARA_FUNCIONAMENTO,
                "issuing_authority": "Prefeitura Municipal",
                "duration_days": 365,
                "applies_to": [TipoEmpresa.COMERCIO, TipoEmpresa.INDUSTRIA, TipoEmpresa.SERVICO],
            },
            {
                "type": LicenseType.INSCRICAO_MUNICIPAL,
                "issuing_authority": "Secretaria Municipal da Fazenda",
                "duration_days": None,  # Sem vencimento
                "applies_to": [TipoEmpresa.COMERCIO, TipoEmpresa.INDUSTRIA, TipoEmpresa.SERVICO],
            },
            {
                "type": LicenseType.INSCRICAO_ESTADUAL,
                "issuing_authority": "Secretaria Estadual da Fazenda",
                "duration_days": None,  # Sem vencimento
                "applies_to": [TipoEmpresa.COMERCIO, TipoEmpresa.INDUSTRIA],
            },
            {
                "type": LicenseType.CERTIFICADO_DIGITAL,
                "issuing_authority": "Autoridade Certificadora",
                "duration_days": 365,
                "applies_to": [TipoEmpresa.COMERCIO, TipoEmpresa.INDUSTRIA, TipoEmpresa.SERVICO, TipoEmpresa.FINANCEIRO],
            },
            {
                "type": LicenseType.LICENCA_SANITARIA,
                "issuing_authority": "Vigilância Sanitária",
                "duration_days": 365,
                "applies_to": [TipoEmpresa.COMERCIO, TipoEmpresa.SERVICO],
            },
            {
                "type": LicenseType.LICENCA_BOMBEIROS,
                "issuing_authority": "Corpo de Bombeiros",
                "duration_days": 365,
                "applies_to": [TipoEmpresa.COMERCIO, TipoEmpresa.INDUSTRIA, TipoEmpresa.SERVICO],
            },
            {
                "type": LicenseType.LICENCA_AMBIENTAL,
                "issuing_authority": "Secretaria do Meio Ambiente",
                "duration_days": 730,  # 2 anos
                "applies_to": [TipoEmpresa.INDUSTRIA],
            },
        ]

        for client in clients:
            # Pular MEI para algumas licenças
            if client.regime_tributario == RegimeTributario.MEI:
                continue

            for config in license_configs:
                if client.tipo_empresa not in config["applies_to"]:
                    continue

                issue_date = client.data_abertura or date(2020, 1, 1)

                if config["duration_days"]:
                    expiration_date = issue_date + timedelta(days=config["duration_days"])

                    # Determinar status baseado na validade
                    days_to_expire = (expiration_date - date.today()).days
                    if days_to_expire < 0:
                        status = LicenseStatus.VENCIDA
                    elif days_to_expire < 30:
                        status = LicenseStatus.PENDENTE_RENOVACAO
                    else:
                        status = LicenseStatus.ATIVA
                else:
                    expiration_date = None
                    status = LicenseStatus.ATIVA

                registration_number = f"{config['type'].value.upper()}-{client.cnpj[:8]}-{randint(1000, 9999)}"

                license = License(
                    client_id=client.id,
                    license_type=config["type"],
                    registration_number=registration_number,
                    issuing_authority=config["issuing_authority"],
                    issue_date=issue_date,
                    expiration_date=expiration_date,
                    status=status,
                    notes=f"{config['type'].value.replace('_', ' ').title()} do cliente {client.nome_fantasia or client.razao_social}",
                )
                session.add(license)
                licenses.append(license)

        await session.commit()
        print(f"OK - Criadas {len(licenses)} licencas")

        # ====================================================================
        # 5. CRIAR TRANSAÇÕES FINANCEIRAS
        # ====================================================================
        print("\n>> Criando transacoes financeiras...")

        transactions = []

        for client in clients:
            # Criar transações dos últimos 6 meses
            for month_offset in range(-5, 1):  # -5 a 0 (últimos 6 meses)
                reference_date = date.today().replace(day=1) + timedelta(days=30 * month_offset)

                # ========== RECEITA: Honorários mensais ==========
                due_date = reference_date.replace(day=client.dia_vencimento)

                # Determinar se foi pago
                if month_offset < 0:  # Meses passados
                    payment_status = choice([
                        PaymentStatus.PAGO,
                        PaymentStatus.PAGO,
                        PaymentStatus.PAGO,
                        PaymentStatus.ATRASADO,
                    ])
                else:  # Mês atual
                    if due_date <= date.today():
                        payment_status = choice([PaymentStatus.PAGO, PaymentStatus.PENDENTE])
                    else:
                        payment_status = PaymentStatus.PENDENTE

                paid_date = None
                if payment_status == PaymentStatus.PAGO:
                    paid_date = due_date + timedelta(days=randint(0, 5))

                transaction = FinancialTransaction(
                    client_id=client.id,
                    created_by_id=user.id,
                    transaction_type=TransactionType.RECEITA,
                    amount=client.honorarios_mensais,
                    payment_method=choice([PaymentMethod.PIX, PaymentMethod.BOLETO, PaymentMethod.TRANSFERENCIA]) if payment_status == PaymentStatus.PAGO else None,
                    payment_status=payment_status,
                    due_date=due_date,
                    paid_date=paid_date,
                    reference_month=reference_date,
                    description=f"Honorários contábeis - {reference_date.strftime('%m/%Y')}",
                    invoice_number=f"INV-{client.cnpj[:8]}-{reference_date.strftime('%Y%m')}" if payment_status == PaymentStatus.PAGO else None,
                )
                session.add(transaction)
                transactions.append(transaction)

                # ========== DESPESAS: Taxas e impostos (aleatório) ==========
                if randint(1, 100) <= 40:  # 40% de chance de ter despesa no mês
                    expense_types = [
                        ("Taxa de registro", 150, 350),
                        ("Certidão negativa", 50, 150),
                        ("Taxa de licença", 200, 500),
                        ("Autenticação de documentos", 30, 100),
                    ]

                    expense_type = choice(expense_types)
                    expense_amount = Decimal(str(uniform(expense_type[1], expense_type[2]))).quantize(Decimal("0.01"))

                    expense_due = reference_date + timedelta(days=randint(5, 25))
                    expense_paid = month_offset < 0  # Despesas de meses passados foram pagas

                    transaction = FinancialTransaction(
                        client_id=client.id,
                        created_by_id=user.id,
                        transaction_type=TransactionType.DESPESA,
                        amount=expense_amount,
                        payment_method=choice([PaymentMethod.PIX, PaymentMethod.TRANSFERENCIA]) if expense_paid else None,
                        payment_status=PaymentStatus.PAGO if expense_paid else PaymentStatus.PENDENTE,
                        due_date=expense_due,
                        paid_date=expense_due + timedelta(days=randint(0, 3)) if expense_paid else None,
                        reference_month=reference_date,
                        description=f"{expense_type[0]} - {client.nome_fantasia or client.razao_social}",
                    )
                    session.add(transaction)
                    transactions.append(transaction)

        await session.commit()
        print(f"OK - Criadas {len(transactions)} transacoes financeiras")

        # ====================================================================
        # RESUMO FINAL
        # ====================================================================
        print("\n" + "="*70)
        print("SEED COMPLETO FINALIZADO COM SUCESSO!")
        print("="*70)
        print(f"\nRESUMO:")
        print(f"   - {len(clients)} clientes criados")
        print(f"   - {len(obligations) if obligation_types else 0} obrigacoes criadas")
        print(f"   - {len(licenses)} licencas criadas")
        print(f"   - {len(transactions)} transacoes financeiras criadas")

        print(f"\nCLIENTES POR REGIME TRIBUTARIO:")
        regimes_count = {}
        for client in clients:
            regime = client.regime_tributario.value
            regimes_count[regime] = regimes_count.get(regime, 0) + 1
        for regime, count in regimes_count.items():
            print(f"   - {regime.replace('_', ' ').title()}: {count}")

        print(f"\nCLIENTES POR TIPO DE EMPRESA:")
        tipos_count = {}
        for client in clients:
            tipo = client.tipo_empresa.value
            tipos_count[tipo] = tipos_count.get(tipo, 0) + 1
        for tipo, count in tipos_count.items():
            print(f"   - {tipo.title()}: {count}")

        print(f"\nTRANSACOES FINANCEIRAS:")
        receitas = sum(1 for t in transactions if t.transaction_type == TransactionType.RECEITA)
        despesas = sum(1 for t in transactions if t.transaction_type == TransactionType.DESPESA)
        total_receitas = sum(t.amount for t in transactions if t.transaction_type == TransactionType.RECEITA)
        total_despesas = sum(t.amount for t in transactions if t.transaction_type == TransactionType.DESPESA)
        print(f"   - Receitas: {receitas} (R$ {total_receitas:,.2f})")
        print(f"   - Despesas: {despesas} (R$ {total_despesas:,.2f})")
        print(f"   - Saldo: R$ {(total_receitas - total_despesas):,.2f}")

        print("\n" + "="*70)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_complete())
