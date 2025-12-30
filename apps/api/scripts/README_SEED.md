# Script de Seed Completo - ContabilConsult

Este documento descreve o script de seed completo criado para popular o banco de dados com dados de teste realistas.

## Scripts Disponíveis

### 1. `seed_complete.py`
Script principal que cria todos os dados de teste de uma vez.

### 2. `validate_seed.py`
Script de validação que verifica os dados criados.

## Como Executar

### Executar o Seed Completo

```bash
cd apps/api
venv/Scripts/python.exe scripts/seed_complete.py
```

### Validar os Dados Criados

```bash
cd apps/api
venv/Scripts/python.exe scripts/validate_seed.py
```

## O Que É Criado

### 📊 Resumo Geral

- **11 clientes** de diferentes tipos e regimes tributários
- **522 obrigações** fiscais distribuídas entre os clientes
- **46 licenças** de diversos tipos
- **92 transações financeiras** (receitas e despesas)

### 👥 Clientes por Regime Tributário

1. **Simples Nacional (3 clientes)**
   - Mercado São Pedro Ltda (Comércio)
   - Padaria Pão Quentinho Ltda (Comércio)
   - Consultoria Tech Solutions Ltda (Serviço)

2. **Lucro Presumido (3 clientes)**
   - Indústria de Móveis Madeira Nobre S.A. (Indústria)
   - Atacado Distribuidora Central Ltda (Comércio)
   - Escritório de Advocacia Silva & Associados (Serviço)

3. **Lucro Real (3 clientes)**
   - Construtora Edificar S.A. (Indústria)
   - Hospital Santa Casa da Saúde S.A. (Serviço)
   - Banco de Investimentos Capital S.A. (Financeiro)

4. **MEI (2 clientes)**
   - João da Silva - MEI (Eletricista)
   - Maria dos Santos - MEI (Costureira)

### 🏢 Clientes por Tipo de Empresa

- **Comércio**: 3 clientes
- **Serviço**: 5 clientes
- **Indústria**: 2 clientes
- **Financeiro**: 1 cliente

### 📋 Obrigações

As obrigações são criadas automaticamente com base nos tipos de obrigações cadastrados no sistema e aplicadas de acordo com o regime tributário e tipo de empresa de cada cliente.

**Distribuição por Status:**
- **Pendente**: ~345 obrigações
- **Em Andamento**: ~3 obrigações
- **Concluída**: ~106 obrigações (60% das do mês atual)
- **Atrasada**: ~68 obrigações
- **Cancelada**: 0 obrigações

**Período Coberto:**
- Próximos 3 meses de obrigações para cada cliente

### 📜 Licenças

Cada cliente (exceto MEI) recebe licenças aplicáveis ao seu tipo de negócio:

1. **Alvará de Funcionamento** - Válido por 1 ano
2. **Inscrição Municipal** - Sem vencimento
3. **Inscrição Estadual** - Sem vencimento (apenas Comércio e Indústria)
4. **Certificado Digital** - Válido por 1 ano
5. **Licença Sanitária** - Válido por 1 ano (Comércio e Serviço)
6. **Licença de Bombeiros** - Válido por 1 ano
7. **Licença Ambiental** - Válido por 2 anos (apenas Indústria)

**Status das Licenças:**
- Ativa
- Vencida (se a data de expiração passou)
- Pendente de Renovação (falta menos de 30 dias para vencer)

### 💰 Transações Financeiras

#### Receitas (66 transações - R$ 330.300,00)
- **Honorários Mensais**: Gerados automaticamente para cada cliente
- **Últimos 6 meses**: Cobertura completa de receitas

#### Despesas (26 transações - R$ 3.637,74)
- Taxa de registro
- Certidão negativa
- Taxa de licença
- Autenticação de documentos

**Status de Pagamento:**
- **Pendente**: 7 transações
- **Pago**: 68 transações
- **Atrasado**: 17 transações

**Saldo Total**: R$ 326.662,26

## Dados Completos dos Clientes

Cada cliente possui TODOS os campos preenchidos:

### Informações da Empresa
- Razão Social
- Nome Fantasia
- CNPJ
- Inscrição Estadual (quando aplicável)
- Inscrição Municipal (quando aplicável)
- Regime Tributário
- Tipo de Empresa
- Data de Abertura
- Data de Início no Escritório

### Contato
- Email
- Telefone
- Celular

### Endereço Completo
- CEP
- Logradouro
- Número
- Bairro
- Cidade
- UF

### Financeiro
- Honorários Mensais
- Dia de Vencimento
- Serviços Contratados

### Responsável
- Nome
- CPF
- Email
- Telefone

### Credenciais de Sistemas
- CPF da Empresa
- Senha Gov.br
- Senha Prefeitura
- Login/Senha Seguro Desemprego
- Email Seguro Desemprego
- Senha NFS-e
- Senha Certificado Digital

### Observações
- Notas sobre o cliente

## Exemplo de Uso para Testes

### 1. Testar Relatórios de Obrigações

Os dados criados permitem testar:
- Relatórios de obrigações pendentes
- Obrigações por período (mês atual, próximos 3 meses)
- Obrigações por cliente
- Obrigações por status
- Obrigações atrasadas

### 2. Testar Livro Caixa

Com as transações financeiras criadas, você pode testar:
- Livro caixa mensal
- Fluxo de caixa
- Contas a receber
- Contas a pagar
- Relatórios de inadimplência

### 3. Testar Gestão de Licenças

Os dados permitem testar:
- Licenças vencidas
- Licenças próximas do vencimento (30 dias)
- Renovação de licenças
- Alertas de vencimento

### 4. Testar Filtros e Buscas

Com a variedade de clientes, você pode testar:
- Filtro por regime tributário
- Filtro por tipo de empresa
- Busca por CNPJ
- Busca por razão social
- Filtro por status

## Limpeza de Dados

⚠️ **ATENÇÃO**: O script `seed_complete.py` LIMPA todos os dados existentes antes de criar novos dados.

Se você quiser manter os dados existentes, comente as linhas de limpeza no script:

```python
# Comentar estas linhas para NÃO limpar dados existentes
# await session.execute(delete(FinancialTransaction))
# await session.execute(delete(Obligation))
# await session.execute(delete(License))
# await session.execute(delete(Client))
# await session.commit()
```

## Pré-requisitos

Antes de executar o script de seed, certifique-se de:

1. ✅ Banco de dados PostgreSQL rodando
2. ✅ Migrations aplicadas (`alembic upgrade head`)
3. ✅ Usuário criado no sistema (`seed_users.py`)
4. ✅ Tipos de obrigações criados (`seed_obligation_types.py`)

## Troubleshooting

### Erro: "Nenhum usuário encontrado"

Execute primeiro:
```bash
venv/Scripts/python.exe scripts/seed_users.py
```

### Erro: "Nenhum tipo de obrigação encontrado"

Execute primeiro:
```bash
venv/Scripts/python.exe scripts/seed_obligation_types.py
```

### Erro de encoding (emojis)

Todos os emojis foram removidos do script para evitar problemas de encoding no Windows.

## Estrutura de Dados Criada

```
Clientes (11)
├── Obrigações (522 total)
│   ├── Baseadas nos tipos de obrigações cadastrados
│   ├── Aplicadas conforme regime tributário
│   └── Distribuídas nos próximos 3 meses
│
├── Licenças (46 total)
│   ├── Alvará de Funcionamento
│   ├── Inscrições (Municipal/Estadual)
│   ├── Certificado Digital
│   ├── Licenças Sanitária, Bombeiros, Ambiental
│   └── Datas de validade calculadas
│
└── Transações Financeiras (92 total)
    ├── Receitas: Honorários mensais (últimos 6 meses)
    └── Despesas: Taxas e certidões (aleatório)
```

## Casos de Teste Cobertos

### Por Regime Tributário
- ✅ Simples Nacional
- ✅ Lucro Presumido
- ✅ Lucro Real
- ✅ MEI

### Por Tipo de Empresa
- ✅ Comércio
- ✅ Serviço
- ✅ Indústria
- ✅ Financeiro

### Por Status de Obrigação
- ✅ Pendente
- ✅ Em Andamento
- ✅ Concluída
- ✅ Atrasada

### Por Status de Licença
- ✅ Ativa
- ✅ Vencida
- ✅ Pendente de Renovação

### Por Status de Pagamento
- ✅ Pendente
- ✅ Pago
- ✅ Atrasado

## Dados Realistas

Todos os dados foram criados para serem o mais realistas possível:

- ✅ CNPJs formatados corretamente
- ✅ CPFs formatados corretamente
- ✅ CEPs válidos de cidades reais
- ✅ Endereços reais (Av. Paulista, Av. Faria Lima, etc.)
- ✅ Emails profissionais
- ✅ Telefones formatados
- ✅ Valores de honorários condizentes com o porte
- ✅ Datas de abertura coerentes
- ✅ Senhas de sistemas preenchidas

## Próximos Passos

Após executar o seed, você pode:

1. Acessar a aplicação web e visualizar os clientes
2. Testar relatórios de obrigações
3. Testar geração de livro caixa
4. Testar alertas de licenças vencendo
5. Testar fluxo de caixa e inadimplência
6. Exportar relatórios em diferentes formatos

---

**Criado em**: 2025-12-30
**Última atualização**: 2025-12-30
