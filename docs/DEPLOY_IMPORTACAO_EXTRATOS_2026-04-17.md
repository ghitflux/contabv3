# Deploy - Importação de Extratos Bancários - 2026-04-17

## Objetivo

Adicionar ao módulo financeiro a importação de extratos bancários com fluxo de prévia antes da gravação, disponível para:

- `admin`
- `func`
- `cliente`

Formatos suportados no `v1`:

- `CSV`
- `OFX`
- `PDF` com texto nativo

---

## Escopo funcional

### Fluxo da importação

1. Usuário escolhe a `conta bancária` do sistema.
2. Usuário envia um arquivo `CSV`, `OFX` ou `PDF`.
3. Backend interpreta o extrato e cria um lote em staging.
4. Frontend exibe a prévia com:
   - linhas detectadas;
   - valor;
   - saldo;
   - tipo inferido (`Entrada` ou `Saída`);
   - suspeita de duplicidade;
   - edição de `categoria`;
   - edição de `observação`;
   - seleção manual de quais linhas importar.
5. Ao confirmar, o sistema cria os lançamentos financeiros já como `PAGO`.

### Regras principais

- a importação é sempre vinculada a uma `bank_account` existente;
- o tipo do lançamento é inferido pelo sinal do valor:
  - positivo: `RECEITA`
  - negativo: `DESPESA`
- o valor salvo em `financial_transactions.amount` fica absoluto;
- linhas suspeitas de duplicidade ficam `desmarcadas` por padrão;
- categoria é obrigatória para qualquer linha selecionada;
- cliente só pode importar para contas da própria empresa;
- escritório pode importar para contas do escritório e dos clientes conforme a tela.

---

## Arquivos principais

### Backend

- `apps/api/alembic/versions/20260417_0900_add_statement_imports_and_bank_link.py`
- `apps/api/app/api/v1/routes/finance_imports.py`
- `apps/api/app/db/models/finance.py`
- `apps/api/app/db/models/bank_account.py`
- `apps/api/app/schemas/finance.py`
- `apps/api/app/services/finance/statement_import_service.py`
- `apps/api/app/services/finance/transaction_service.py`
- `apps/api/app/api/v1/routes/finance.py`
- `apps/api/app/api/v1/router.py`
- `apps/api/tests/unit/services/test_statement_import_service.py`
- `apps/api/tests/integration/test_finance_statement_import_routes.py`

### Frontend

- `apps/web/src/components/features/financeiro/StatementImportModal.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroPorEmpresa.tsx`
- `apps/web/src/components/features/financeiro/ClienteLancamentoRapidoCard.tsx`
- `apps/web/src/lib/api/endpoints/finance.ts`
- `apps/web/src/types/finance.ts`

---

## Estrutura técnica

### Novas tabelas

#### `statement_imports`

Lote da importação com:

- cliente alvo;
- conta bancária;
- formato de origem;
- período detectado;
- saldo inicial e final;
- total de linhas;
- total de duplicidades;
- status da importação.

#### `statement_import_rows`

Staging das linhas detectadas com:

- data;
- descrição;
- histórico bruto;
- valor assinado;
- saldo após o movimento;
- tipo;
- confiança do parser;
- flag de seleção;
- flag de duplicidade;
- categoria;
- observação;
- vínculo com transação efetivamente criada.

### Ajuste em `financial_transactions`

Novo campo:

- `bank_account_id`

Isso permite vincular formalmente o lançamento à conta bancária e melhora a consolidação do `Saldo por Banco`.

---

## Endpoints novos

### `POST /api/v1/finance/imports/preview`

Recebe `multipart/form-data` com:

- `bank_account_id`
- `file`

Retorna:

- metadados do extrato;
- totais;
- linhas detectadas para revisão.

### `GET /api/v1/finance/imports/{import_id}`

Reabre uma prévia já persistida.

### `POST /api/v1/finance/imports/{import_id}/commit`

Recebe a decisão final do usuário por linha:

- importar ou não;
- categoria;
- observação.

Retorna:

- total importado;
- total ignorado;
- total de duplicados pulados;
- ids das transações criadas.

---

## Heurísticas do parser

### CSV

- detecção automática de delimitador;
- suporte a `utf-8`, `utf-8-sig`, `cp1252` e `latin1`;
- leitura de cabeçalhos comuns como:
  - `Data`
  - `Data Lançamento`
  - `Histórico`
  - `Descrição`
  - `Valor`
  - `Saldo`
- suporte a valores brasileiros como `1.234,56`.

### OFX

- leitura de `ACCTID`, `ORG`, `DTSTART`, `DTEND`, `BALAMT`;
- interpretação dos blocos `STMTTRN`;
- extração de `NAME`, `MEMO` e `FITID`.

### PDF

- somente `PDF` com texto nativo;
- rejeita PDF escaneado sem texto extraível;
- tenta detectar:
  - conta;
  - período;
  - linhas com data, descrição, valor e saldo.

---

## Duplicidade

O sistema considera suspeita de duplicidade quando encontra:

- mesma empresa;
- mesma data;
- mesmo tipo;
- mesmo valor;
- descrição semelhante.

Há duas verificações:

- contra lançamentos já existentes na base;
- dentro do próprio lote importado.

As linhas suspeitas:

- aparecem sinalizadas na prévia;
- ficam desmarcadas por padrão;
- só entram se o usuário remarcar explicitamente.

---

## Conversão para lançamentos financeiros

Ao confirmar a importação, cada linha aprovada gera uma `financial_transaction` com:

- `payment_status = pago`
- `due_date = data do movimento`
- `paid_date = data do movimento às 12:00`
- `reference_month = primeiro dia do mês da data`
- `transaction_type = receita|despesa`
- `amount = valor absoluto`
- `bank_account_id = conta escolhida`

Observações do lançamento são compostas com:

- origem da importação;
- banco;
- histórico bruto;
- saldo após o movimento;
- observação digitada pelo usuário.

---

## Auditoria

Foram adicionados registros de auditoria para:

- geração da prévia;
- confirmação da importação.

Eventos registrados:

- `statement_import.preview`
- `statement_import.commit`

---

## Passos de deploy

### 1. Atualizar código

```bash
git fetch origin
git pull origin Main
```

### 2. Atualizar dependências do backend

Se usar `venv` local:

```bash
cd apps/api
venv/Scripts/pip.exe install -e .[dev]
```

Se usar container:

```bash
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

### 3. Aplicar migration

```bash
cd apps/api
venv/Scripts/alembic.exe upgrade head
```

### 4. Validar revisão atual

```bash
cd apps/api
venv/Scripts/alembic.exe current
```

Esperado:

```text
20260417_statement_imports (head)
```

---

## Validação recomendada

### Backend

```bash
cd apps/api
venv/Scripts/pytest.exe tests/unit/services/test_statement_import_service.py -q --no-cov
```

### Interface

Validar manualmente:

1. escritório:
   importar um `CSV` em uma conta do escritório;
2. cliente:
   importar um `CSV` em conta da própria empresa;
3. duplicidade:
   tentar importar novamente o mesmo arquivo e confirmar linhas marcadas como suspeitas;
4. PDF:
   usar um extrato com texto selecionável;
5. OFX:
   validar criação automática de entradas e saídas;
6. saldo por banco:
   confirmar atualização após o commit.

---

## Limitações conhecidas do v1

- PDF com imagem/scan sem OCR não é suportado;
- parser de PDF depende do padrão textual do banco;
- a conta bancária não é criada automaticamente;
- a importação não guarda o arquivo bruto como documento permanente.

---

## Resultado esperado

Após o deploy, o usuário consegue importar extratos bancários, revisar as linhas detectadas e transformar o extrato em lançamentos financeiros com menos digitação manual e menor risco de erro operacional.
