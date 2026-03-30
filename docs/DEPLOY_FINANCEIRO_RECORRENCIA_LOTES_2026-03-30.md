# Deploy: Recorrência, Lotes e Prévia de Honorários

Data: `2026-03-30`

Escopo desta atualização:
- recorrência mensal real para lançamentos rápidos do escritório e do cliente
- KPIs de `Receita do Período` e `Despesas` em base caixa, com drilldown clicável
- operações em massa no financeiro do escritório
- retorno da prévia de honorários com competência correta
- exclusão em massa de honorários com bloqueio de recriação por competência
- migration de banco com novas tabelas e colunas do módulo financeiro

## Revisão de banco

Head esperado após deploy:

```text
20260330_fin_recurring
```

Estruturas criadas/alteradas:
- tabela `financial_recurring_templates`
- tabela `monthly_fee_blocks`
- coluna `financial_transactions.recurring_template_id`
- coluna `financial_transactions.restore_blocked_reason`

## Pré-requisitos

- acesso SSH ao servidor
- projeto atualizado no diretório do deploy
- stack Docker operacional
- backup recente do banco

## Passo 1: backup

```bash
cd /home/deploy/apps/contabil
mkdir -p backups
docker exec contabil-postgres-prod pg_dump -U contabil -d contabil_db --no-owner --no-acl \
  > backups/backup_$(date +%Y%m%d_%H%M%S)_before_finance_recurring.sql
ls -lh backups/ | tail -3
```

## Passo 2: atualizar código

```bash
cd /home/deploy/apps/contabil
git fetch origin
git pull origin Main
git log --oneline -3
```

## Passo 3: aplicar migration

Se a API roda em container:

```bash
cd /home/deploy/apps/contabil/apps/api
docker compose -f ../../docker-compose.prod.yml exec -T api alembic upgrade head
docker compose -f ../../docker-compose.prod.yml exec -T api alembic current
```

Se a API roda fora do container:

```bash
cd /home/deploy/apps/contabil/apps/api
alembic upgrade head
alembic current
```

Resultado esperado no `current`:

```text
20260330_fin_recurring (head)
```

## Passo 4: rebuild/restart da aplicação

```bash
cd /home/deploy/apps/contabil
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

## Passo 5: smoke test mínimo

### 5.1 API

```bash
curl -s http://localhost/api/v1/health
```

### 5.2 Honorários

No financeiro do escritório:
- abrir o mês corrente
- confirmar que a caixa de prévia de honorários aparece
- conferir se `Gerar honorários` não avança para o mês seguinte
- selecionar honorários e testar exclusão em massa em ambiente de homologação

### 5.3 Recorrência

Criar um lançamento recorrente de despesa, por exemplo `Aluguel`:
- marcar `Recorrente`
- salvar
- confirmar que o lançamento nasce com status `Pendente`
- confirmar que ele entra em `Contas a Pagar`
- confirmar que ele não soma em `Despesas` até a baixa

### 5.4 KPIs e lote

No escritório:
- clicar em `Receita do Período` e `Despesas`
- validar que os cards abrem o drilldown correto
- selecionar lançamentos no grid principal
- testar `Marcar pagos`, `Desmarcar baixa` e `Excluir em massa`

### 5.5 Por Empresa

- abrir `Por Empresa`
- clicar nos cards de `RECEITA` e `DESPESA`
- validar que mostram só lançamentos baixados
- validar que `A RECEBER` e `A PAGAR` continuam funcionando
- criar um lançamento recorrente rápido e confirmar o comportamento pendente

## Consultas úteis pós-deploy

Verificar se a migration foi aplicada:

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "
SELECT version_num FROM alembic_version;
"
```

Verificar novas tabelas:

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "\dt financial_recurring_templates"
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "\dt monthly_fee_blocks"
```

Verificar novas colunas:

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'financial_transactions'
  AND column_name IN ('recurring_template_id', 'restore_blocked_reason');
"
```

## Observações importantes

- esta entrega não faz backfill automático de lançamentos antigos que antes eram só “recorrentes” na UI
- honorários excluídos pelo fluxo novo ficam bloqueados para a mesma competência
- a lixeira não deve restaurar honorários bloqueados nem ocorrências de séries encerradas
- se o deploy parar antes da migration, não subir o web novo por cima da API antiga

## Rollback

Se precisar rollback rápido do código:

```bash
cd /home/deploy/apps/contabil
git log --oneline -5
git checkout <commit_anterior_estavel>
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
```

Se precisar rollback de banco, restaurar o dump feito no passo 1.

