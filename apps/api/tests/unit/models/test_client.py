"""
Unit tests for Client model.
"""

from datetime import date

import pytest

from app.db.models.client import Client, ClientStatus, RegimeTributario, TipoEmpresa


def test_client_creation():
    """Test basic client creation."""
    client = Client(
        razao_social="Empresa Teste LTDA",
        nome_fantasia="Empresa Teste",
        cnpj="12.345.678/0001-90",
        email="teste@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.COMERCIO,
        status=ClientStatus.ATIVO,
    )

    assert client.razao_social == "Empresa Teste LTDA"
    assert client.cnpj == "12.345.678/0001-90"
    assert client.honorarios_mensais == 1500.00
    assert client.status == ClientStatus.ATIVO


def test_client_full_data():
    """Test client with all optional fields."""
    client = Client(
        razao_social="Empresa Completa LTDA",
        nome_fantasia="Empresa Completa",
        cnpj="98.765.432/0001-10",
        inscricao_estadual="123.456.789.123",
        inscricao_municipal="123456",
        email="contato@empresa.com",
        telefone="(11) 3333-4444",
        celular="(11) 98888-7777",
        cep="01310-100",
        logradouro="Avenida Paulista",
        numero="1000",
        complemento="Sala 101",
        bairro="Bela Vista",
        cidade="São Paulo",
        uf="SP",
        honorarios_mensais=2500.00,
        dia_vencimento=15,
        regime_tributario=RegimeTributario.LUCRO_PRESUMIDO,
        tipo_empresa=TipoEmpresa.SERVICO,
        data_abertura=date(2020, 1, 15),
        responsavel_nome="João Silva",
        responsavel_cpf="123.456.789-00",
        responsavel_email="joao@empresa.com",
        responsavel_telefone="(11) 99999-8888",
        observacoes="Cliente preferencial",
        status=ClientStatus.ATIVO,
    )

    assert client.inscricao_estadual == "123.456.789.123"
    assert client.cidade == "São Paulo"
    assert client.uf == "SP"
    assert client.responsavel_nome == "João Silva"
    assert client.observacoes == "Cliente preferencial"


def test_client_status_enum():
    """Test all client status values."""
    assert ClientStatus.ATIVO == "ativo"
    assert ClientStatus.INATIVO == "inativo"
    assert ClientStatus.PENDENTE == "pendente"


def test_regime_tributario_enum():
    """Test all regime tributario values."""
    assert RegimeTributario.SIMPLES_NACIONAL == "simples_nacional"
    assert RegimeTributario.LUCRO_PRESUMIDO == "lucro_presumido"
    assert RegimeTributario.LUCRO_REAL == "lucro_real"
    assert RegimeTributario.MEI == "mei"


def test_tipo_empresa_enum():
    """Test all tipo empresa values."""
    assert TipoEmpresa.COMERCIO == "comercio"
    assert TipoEmpresa.SERVICO == "servico"
    assert TipoEmpresa.INDUSTRIA == "industria"
    assert TipoEmpresa.FINANCEIRO == "financeiro"


def test_client_repr():
    """Test client string representation."""
    client = Client(
        razao_social="Empresa Teste LTDA",
        cnpj="12.345.678/0001-90",
        email="teste@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.COMERCIO,
    )

    assert repr(client) == "<Client Empresa Teste LTDA (12.345.678/0001-90)>"


def test_client_soft_delete():
    """Test soft delete functionality."""
    client = Client(
        razao_social="Empresa Teste LTDA",
        cnpj="12.345.678/0001-90",
        email="teste@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.COMERCIO,
        status=ClientStatus.ATIVO,
    )

    assert not client.is_deleted
    assert client.deleted_at is None

    client.soft_delete()

    assert client.is_deleted
    assert client.deleted_at is not None
    assert client.status == ClientStatus.INATIVO


def test_client_default_status():
    """Test client can be created without status (will be set by database)."""
    client = Client(
        razao_social="Empresa Teste LTDA",
        cnpj="12.345.678/0001-90",
        email="teste@empresa.com",
        honorarios_mensais=1500.00,
        dia_vencimento=10,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.COMERCIO,
    )

    # Status will be None until saved to database (server_default applies then)
    assert client.status is None or client.status == ClientStatus.PENDENTE


def test_client_minimal_required_fields():
    """Test client with only required fields."""
    client = Client(
        razao_social="Empresa Teste",
        cnpj="12.345.678/0001-90",
        email="teste@empresa.com",
        honorarios_mensais=1000.00,
        dia_vencimento=10,
        regime_tributario=RegimeTributario.SIMPLES_NACIONAL,
        tipo_empresa=TipoEmpresa.COMERCIO,
    )

    assert client.nome_fantasia is None
    assert client.telefone is None
    assert client.cep is None
    assert client.responsavel_nome is None
