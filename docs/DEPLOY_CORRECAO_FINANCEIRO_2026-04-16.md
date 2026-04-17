# Deploy e Correção Segura do Financeiro - 2026-04-16

## Objetivo

Aplicar em produção a correção do módulo financeiro para:

- alinhar a exibição dos lançamentos pelo mês de competência (`reference_month`);
- corrigir os acumulados anuais na aba `Escritório` e `Por Empresa`;
- trocar o 3º balão inferior de `Distribuição de Lucros` por `Margem de Lucro Atual`;
- corrigir a busca por CNPJ na aba `Clientes`;
- impedir geração automática de honorários além do mês atual;
- sanear os lançamentos do cliente `T DO N CAVALCANTE` (`42.899.568/0001-36`);
- remover honorários automáticos futuros gerados indevidamente;
- sincronizar o par de honorários de `04/2026` desse cliente.

---

## Escopo técnico

### Arquivos alterados

- `apps/api/app/api/v1/routes/finance.py`
- `apps/api/app/db/repositories/transaction.py`
- `apps/web/src/types/finance.ts`
- `apps/web/src/hooks/useTransactions.ts`
- `apps/web/src/lib/api/endpoints/finance.ts`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroPorEmpresa.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroLancamentos.tsx`
- `apps/web/src/lib/api/endpoints/clients.ts`
- `apps/web/app/(dashboard)/clientes/page.tsx`

### Correção de dados aplicada localmente

- `375` honorários automáticos futuros removidos por `soft delete`;
- `179` lançamentos do cliente `42.899.568/0001-36` realinhados para a competência efetiva;
- `1` par de honorários de `04/2026` sincronizado entre escritório e cliente.

---

## Pré-requisitos

- acesso SSH ao servidor;
- projeto atualizado no servidor;
- containers de produção saudáveis;
- acesso ao container do PostgreSQL;
- espaço em disco para backup;
- commit da correção já disponível no repositório remoto.

---

## Regra de segurança

Executar nesta ordem:

1. backup completo do banco;
2. backup do código atual;
3. backup pontual dos dados que serão alterados;
4. deploy do código;
5. validação de containers;
6. correção SQL em transação;
7. validação funcional e validação de dados;
8. só então encerrar a janela.

Se qualquer etapa falhar, parar e executar rollback.

---

## Passo 1 - Acesso e variáveis

```bash
ssh root@SEU_SERVIDOR
cd /home/deploy/apps/contabil
export APP_DIR=/home/deploy/apps/contabil
export PROD_COMPOSE="docker compose -f docker-compose.prod.yml"
export PG_CONTAINER=contabil-postgres-prod
export API_CONTAINER=contabil-api-prod
export WEB_CONTAINER=contabil-web-prod
export DB_NAME=contabil_db
export DB_USER=contabil
mkdir -p backups/2026-04-16-financeiro
```

Se os nomes dos containers forem diferentes, ajustar antes de prosseguir:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## Passo 2 - Backup completo do banco

Gerar backup lógico completo antes de qualquer alteração:

```bash
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  > "backups/2026-04-16-financeiro/backup_full_before_finance_fix_$(date +%Y%m%d_%H%M%S).sql"

ls -lh backups/2026-04-16-financeiro/
```

Critério mínimo:

- arquivo criado;
- tamanho maior que zero;
- comando sem erro.

---

## Passo 3 - Backup do código atual

Registrar o estado atual do repositório antes do `pull`:

```bash
git rev-parse HEAD > backups/2026-04-16-financeiro/git_head_before.txt
git status --short > backups/2026-04-16-financeiro/git_status_before.txt
git diff > backups/2026-04-16-financeiro/git_diff_before.patch
```

Se quiser um backup físico adicional do código:

```bash
tar -czf "backups/2026-04-16-financeiro/code_before_$(date +%Y%m%d_%H%M%S).tar.gz" \
  --exclude node_modules \
  --exclude .next \
  .
```

---

## Passo 4 - Backup pontual dos dados que serão corrigidos

### 4.1. Cliente alvo

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT id, razao_social, cnpj
FROM clients
WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = '42899568000136';
"
```

### 4.2. Exportar lançamentos do cliente alvo

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
COPY (
  SELECT *
  FROM financial_transactions
  WHERE client_id IN (
    SELECT id
    FROM clients
    WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = '42899568000136'
  )
  ORDER BY created_at, id
) TO STDOUT WITH CSV HEADER
" > backups/2026-04-16-financeiro/cliente_42899568000136_financial_transactions_before.csv
```

### 4.3. Exportar honorários automáticos futuros

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
COPY (
  SELECT *
  FROM financial_transactions
  WHERE deleted_at IS NULL
    AND notes ILIKE '%honorários recorrentes%'
    AND reference_month > date_trunc('month', current_date)::date
  ORDER BY reference_month, created_at, id
) TO STDOUT WITH CSV HEADER
" > backups/2026-04-16-financeiro/future_auto_fees_before.csv
```

### 4.4. Registrar contagens antes da correção

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT reference_month, count(*)
FROM financial_transactions
WHERE deleted_at IS NULL
  AND notes ILIKE '%honorários recorrentes%'
  AND reference_month > date_trunc('month', current_date)::date
GROUP BY reference_month
ORDER BY reference_month;
"

docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  reference_month,
  date_trunc('month', coalesce(paid_date::date, due_date))::date AS effective_month,
  count(*)
FROM financial_transactions
WHERE deleted_at IS NULL
  AND client_id IN (
    SELECT id
    FROM clients
    WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = '42899568000136'
  )
GROUP BY 1, 2
HAVING reference_month <> date_trunc('month', coalesce(paid_date::date, due_date))::date
ORDER BY 1, 2;
"
```

---

## Passo 5 - Deploy do código

```bash
cd "$APP_DIR"
git fetch origin
git pull origin Main
git log --oneline -3
```

Se o branch principal no servidor não for `Main`, ajustar para o branch correto.

### Rebuild da API e Web

```bash
$PROD_COMPOSE build --no-cache api web
$PROD_COMPOSE up -d --force-recreate api web
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

### Health check

```bash
curl -sS http://127.0.0.1:8000/api/v1/health
docker logs "$API_CONTAINER" --tail=50
docker logs "$WEB_CONTAINER" --tail=50
```

Critério mínimo:

- API respondendo health check;
- frontend subindo sem erro crítico;
- PostgreSQL saudável.

---

## Passo 6 - Correção segura do banco

Executar tudo em transação. Não confirmar sem revisar os números retornados.

```bash
docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;

WITH target_client AS (
  SELECT id
  FROM clients
  WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = '42899568000136'
),
future_auto AS (
  UPDATE financial_transactions
  SET
    deleted_at = NOW(),
    updated_at = NOW(),
    restore_blocked_reason = 'Honorário automático futuro removido após correção de competência em 16/04/2026.'
  WHERE deleted_at IS NULL
    AND notes ILIKE '%honorários recorrentes%'
    AND reference_month > date_trunc('month', current_date)::date
  RETURNING id
),
manual_realign AS (
  UPDATE financial_transactions ft
  SET
    reference_month = date_trunc('month', coalesce(ft.paid_date::date, ft.due_date))::date,
    updated_at = NOW()
  WHERE ft.deleted_at IS NULL
    AND ft.client_id IN (SELECT id FROM target_client)
    AND (ft.notes IS NULL OR ft.notes NOT ILIKE '%honorários recorrentes%')
    AND ft.reference_month <> date_trunc('month', coalesce(ft.paid_date::date, ft.due_date))::date
  RETURNING ft.id
),
sync_client_fee AS (
  UPDATE financial_transactions client_tx
  SET
    payment_status = office_tx.payment_status,
    payment_method = office_tx.payment_method,
    paid_date = office_tx.paid_date,
    updated_at = NOW()
  FROM financial_transactions office_tx
  WHERE client_tx.id = 'd4e43fd6-44b9-440a-9b18-3218fe61e402'
    AND office_tx.id = 'b8c6e806-3194-43a0-9b99-6bc089168591'
    AND client_tx.payment_status <> office_tx.payment_status
  RETURNING client_tx.id
)
SELECT
  (SELECT count(*) FROM future_auto) AS future_auto_soft_deleted,
  (SELECT count(*) FROM manual_realign) AS client_transactions_realigned,
  (SELECT count(*) FROM sync_client_fee) AS april_fee_pairs_synced;

COMMIT;
SQL
```

### Resultado esperado

Em um cenário equivalente ao ambiente validado localmente:

- `future_auto_soft_deleted = 375`
- `client_transactions_realigned = 179`
- `april_fee_pairs_synced = 1`

Se os números forem muito diferentes, parar e revisar antes de seguir.

---

## Passo 7 - Validação pós-correção

### 7.1. Confirmar que não restaram honorários automáticos futuros

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT reference_month, count(*)
FROM financial_transactions
WHERE deleted_at IS NULL
  AND notes ILIKE '%honorários recorrentes%'
  AND reference_month > date_trunc('month', current_date)::date
GROUP BY reference_month
ORDER BY reference_month;
"
```

Resultado esperado: `0 rows`.

### 7.2. Confirmar que o cliente não tem mais competência desalinhada

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  reference_month,
  date_trunc('month', coalesce(paid_date::date, due_date))::date AS effective_month,
  count(*)
FROM financial_transactions
WHERE deleted_at IS NULL
  AND client_id IN (
    SELECT id
    FROM clients
    WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = '42899568000136'
  )
GROUP BY 1, 2
HAVING reference_month <> date_trunc('month', coalesce(paid_date::date, due_date))::date
ORDER BY 1, 2;
"
```

Resultado esperado: `0 rows`.

### 7.3. Confirmar sincronização do honorário de abril

```bash
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT id, payment_status, payment_method, reference_month, due_date, paid_date::date AS paid_date, amount, description
FROM financial_transactions
WHERE id IN (
  'd4e43fd6-44b9-440a-9b18-3218fe61e402',
  'b8c6e806-3194-43a0-9b99-6bc089168591'
)
ORDER BY id;
"
```

Resultado esperado:

- ambos `PAGO`;
- ambos com `payment_method = TRANSFERENCIA`;
- ambos com `paid_date = 2026-03-12`.

### 7.4. Validar a prévia de honorários para abril/2026

```bash
docker exec "$API_CONTAINER" sh -lc "python - <<'PY'
import asyncio
from datetime import date
from app.db.session import get_session_context
from app.services.finance.fee_generator_service import FeeGeneratorService

async def main():
    async with get_session_context() as db:
        preview = await FeeGeneratorService(db).preview_monthly_fees(reference_month=date(2026, 4, 1))
        print('reference_month=', preview['reference_month'])
        print('would_generate_count=', preview['would_generate_count'])
        print('would_generate_entries=', preview['would_generate_entries'])
        print('blocked_count=', preview['blocked_count'])

asyncio.run(main())
PY"
```

Resultado esperado no ambiente validado:

- `reference_month = 2026-04-01`
- sem geração indevida de maio/junho por efeito colateral de consulta anual.

---

## Passo 8 - Validação funcional na interface

Validar manualmente:

1. Aba `Financeiro > Escritório`
   - selecionar fevereiro, março e abril;
   - confirmar que os lançamentos aparecem no mês correto;
   - confirmar que `Lucro do Ano` e `Distribuição no Ano` usam acumulado;
   - confirmar que o card inferior agora mostra `Margem de Lucro Atual`.

2. Aba `Financeiro > Por Empresa`
   - pesquisar e abrir o cliente `42.899.568/0001-36`;
   - alternar os meses e conferir se janeiro não aparece em março;
   - validar acumulado anual.

3. Aba `Clientes`
   - digitar `42899568000136`;
   - digitar `42.899.568/0001-36`;
   - digitar parte do CNPJ;
   - confirmar que a busca encontra o cliente corretamente.

4. Aba `Honorários dos Clientes`
   - selecionar `abril/2026`;
   - confirmar que a competência exibida e a prévia batem com abril;
   - confirmar que não há recriação automática de maio/junho ao apenas abrir o painel.

---

## Rollback

### Rollback de código

Voltar ao commit anterior:

```bash
cd "$APP_DIR"
PREV_COMMIT=$(cat backups/2026-04-16-financeiro/git_head_before.txt)
git checkout "$PREV_COMMIT"
$PROD_COMPOSE build --no-cache api web
$PROD_COMPOSE up -d --force-recreate api web
```

### Rollback de banco

Se precisar restaurar tudo:

```bash
cd "$APP_DIR"
docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME';"
docker exec "$PG_CONTAINER" dropdb -U "$DB_USER" "$DB_NAME"
docker exec "$PG_CONTAINER" createdb -U "$DB_USER" "$DB_NAME"
cat backups/2026-04-16-financeiro/backup_full_before_finance_fix_*.sql | \
  docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
```

### Rollback pontual

Se o problema for só no cliente alvo ou só nos honorários futuros, usar os CSVs exportados em `backups/2026-04-16-financeiro/` como base para restauração manual assistida.

Não fazer `UPDATE` ou `INSERT` de rollback sem comparar com o backup pontual.

---

## Checklist final

- [ ] backup completo gerado e validado;
- [ ] backup pontual do cliente e dos honorários futuros gerado;
- [ ] código atualizado no servidor;
- [ ] API e WEB rebuildados com sucesso;
- [ ] health check da API respondendo;
- [ ] correção SQL executada com contagens coerentes;
- [ ] sem honorários automáticos futuros ativos;
- [ ] cliente `42.899.568/0001-36` sem competência desalinhada;
- [ ] par de honorários de abril sincronizado;
- [ ] busca por CNPJ validada;
- [ ] cards do financeiro validados na interface;
- [ ] plano de rollback disponível no mesmo diretório de backup.

---

## Observação operacional

Esta correção não depende de migration nova. O risco principal está nos dados já gravados e na geração automática de honorários. Por isso o backup pontual do cliente afetado e dos honorários futuros é obrigatório, mesmo com `pg_dump` completo já gerado.
