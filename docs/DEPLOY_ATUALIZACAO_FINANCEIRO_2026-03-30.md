# Deploy das Atualizações do Financeiro - 2026-03-30

## Histórico de execução

| Data       | Commit  | Resultado                                            |
|------------|---------|------------------------------------------------------|
| 2026-03-30 | 96ec66b | Executado com sucesso após 2 hotfixes de TypeScript  |

### O que foi entregue

- Recriação da lógica mensal de honorários por competência
- Reparo de lançamentos de honorários gerados um mês à frente
- Limpeza dos lotes indevidos de março/2026 e maio/2026
- Correção da listagem do financeiro para que `Mês de referência` use sempre `reference_month`
- Formulário de lançamento rápido para cliente na aba `Por Empresa`
- Ajustes do filtro mensal em todas as tabs do módulo financeiro
- Busca por texto em todas as tabs do painel financeiro

### Problemas encontrados durante o deploy

1. **Diretório do projeto**: o documento anterior apontava `/opt/contabilconsult`. O correto é `/home/deploy/apps/contabil`.

2. **Erro de TypeScript no build web** (2 hotfixes necessários):
   - `TableHeader` do HeroUI não aceita `{condition && <TableColumn>}` — tipo `boolean|Element` não é `ColumnElement`.
   - `TableRow` do HeroUI não aceita `{condition && <TableCell>}` — tipo `boolean|Element` não é `CellElement`.
   - **Regra para próximos deploys**: qualquer coluna ou célula condicional em tabelas HeroUI deve ser sempre renderizada (com CSS `hidden` quando não aplicável), nunca com `&&` direto.

3. **Honorários de abril incompletos após os reparos**:
   - O script `repair_honorarios_competencia` reportou 146 conflitos (`target_month_already_exists`) que não foram movidos automaticamente.
   - Resultado: abril/2026 ficou com apenas 60 RECEITAs e 86 DESPESAs em vez de 93/93.
   - Foi necessário inserir manualmente os 33 RECEITAs e 7 DESPESAs faltantes via SQL.
   - **Regra para próximos deploys**: sempre executar a query de verificação de honorários por competência imediatamente após os reparos e antes de encerrar o deploy.

4. **Backup em formato plain text vs custom**: o backup foi feito com `pg_dump --no-owner --no-acl` (formato texto). O rollback com `pg_restore` exige formato custom (`-F c`). Este documento agora usa plain text em ambos para consistência.

---

## Procedimento para próximos deploys

### Pré-requisitos

- Acesso SSH ao servidor: `ssh root@72.60.5.58`
- Projeto em: `/home/deploy/apps/contabil`
- Docker e Docker Compose operacionais
- Containers de produção em `docker-compose.prod.yml`

---

### Passo 1 — Backup

```bash
ssh root@72.60.5.58
cd /home/deploy/apps/contabil
mkdir -p backups
docker exec contabil-postgres-prod pg_dump -U contabil -d contabil_db --no-owner --no-acl \
  > backups/backup_$(date +%Y%m%d_%H%M%S)_before_deploy.sql
ls -lh backups/ | tail -3
```

Verificar que o arquivo foi criado com tamanho > 0.

---

### Passo 2 — Atualizar o código

```bash
cd /home/deploy/apps/contabil
git fetch origin
git pull origin Main
git log --oneline -3
```

Confirmar que o commit local bate com o commit do repositório remoto.

---

### Passo 3 — Validação TypeScript antes do build (obrigatório)

Antes de rebuildar, revisar se algum arquivo alterado usa renderização condicional em componentes HeroUI `Table`:

```tsx
# Padrão PROIBIDO em TableHeader e TableRow:
{condition && <TableColumn>...</TableColumn>}
{condition && <TableCell>...</TableCell>}

# Padrão CORRETO:
<TableColumn className={condition ? '' : 'hidden w-0 p-0'}>
  {condition ? 'Título' : ''}
</TableColumn>
<TableCell className={condition ? '' : 'hidden w-0 p-0'}>
  {condition && <Componente />}
</TableCell>
```

Se houver esse padrão nos arquivos alterados, corrigir, commitar e fazer push antes de buildar.

---

### Passo 4 — Rebuild e restart (somente API e WEB, sem cache)

```bash
cd /home/deploy/apps/contabil
docker compose -f docker-compose.prod.yml build --no-cache api web
```

Em caso de erro de build, capturar a mensagem completa:

```bash
docker compose -f docker-compose.prod.yml build --no-cache web 2>&1 | grep -E "Type error|Error:|failed" | head -20
```

Após build com sucesso:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Todos os containers devem estar `Up`. PostgreSQL deve estar `healthy`.

---

### Passo 5 — Reparos obrigatórios no banco

#### 5.1. Corrigir honorários gerados um mês à frente

```bash
cd /home/deploy/apps/contabil
docker compose -f docker-compose.prod.yml exec -T api python -m scripts.repair_honorarios_competencia
```

Resultado esperado:

```text
[INFO] Scanned: N
[INFO] Updated: N
[INFO] Skipped: N
[INFO] Conflicts: N
```

Conflitos são normais quando já existe lançamento no mês alvo. Prosseguir para 5.2 e 5.3.

#### 5.2. Arquivar lote bugado de maio/2026 (se existir)

Verificar primeiro se há lançamentos a arquivar:

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "
SELECT count(*) FROM financial_transactions
WHERE deleted_at IS NULL
  AND reference_month = DATE '2026-05-01'
  AND (
    (transaction_type = 'DESPESA' AND description LIKE 'Honorários do escritório - %')
    OR (transaction_type = 'RECEITA' AND description LIKE 'Honorários - %')
  )
  AND notes ILIKE '%honorários recorrentes%'
  AND payment_status = 'PENDENTE'
  AND created_at >= TIMESTAMP '2026-03-25 00:00:00'
  AND created_at < TIMESTAMP '2026-03-26 00:00:00';
"
```

Se count > 0, executar:

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db << 'SQL'
WITH target AS (
  SELECT id
  FROM financial_transactions
  WHERE deleted_at IS NULL
    AND reference_month = DATE '2026-05-01'
    AND (
      (transaction_type = 'DESPESA' AND description LIKE 'Honorários do escritório - %')
      OR
      (transaction_type = 'RECEITA' AND description LIKE 'Honorários - %')
    )
    AND notes ILIKE '%honorários recorrentes%'
    AND payment_status = 'PENDENTE'
    AND created_at >= TIMESTAMP '2026-03-25 00:00:00'
    AND created_at < TIMESTAMP '2026-03-26 00:00:00'
)
UPDATE financial_transactions ft
SET deleted_at = NOW(), updated_at = NOW()
FROM target
WHERE ft.id = target.id;
SQL
```

#### 5.3. Limpar resíduos de março/2026

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db << 'SQL'
WITH march_ranked AS (
  SELECT
    ft.id,
    ft.transaction_type,
    CASE
      WHEN ft.transaction_type = 'DESPESA' THEN ft.client_id
      WHEN ft.notes ~ 'Cliente: [0-9a-f-]{36}'
        THEN (regexp_match(ft.notes, 'Cliente: ([0-9a-f-]{36})'))[1]::uuid
      ELSE NULL
    END AS related_client_id,
    row_number() OVER (
      PARTITION BY
        CASE
          WHEN ft.transaction_type = 'DESPESA' THEN ft.client_id
          WHEN ft.notes ~ 'Cliente: [0-9a-f-]{36}'
            THEN (regexp_match(ft.notes, 'Cliente: ([0-9a-f-]{36})'))[1]::uuid
          ELSE NULL
        END,
        ft.transaction_type
      ORDER BY ft.created_at DESC, ft.id DESC
    ) AS rn
  FROM financial_transactions ft
  WHERE ft.deleted_at IS NULL
    AND ft.reference_month = DATE '2026-03-01'
    AND (
      (ft.transaction_type = 'DESPESA' AND ft.description LIKE 'Honorários do escritório - %')
      OR
      (
        ft.transaction_type = 'RECEITA'
        AND ft.client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
        AND ft.description LIKE 'Honorários - %'
        AND ft.notes LIKE '%Cliente:%'
      )
    )
),
target AS (
  SELECT mr.id
  FROM march_ranked mr
  LEFT JOIN clients c ON c.id = mr.related_client_id
  WHERE mr.related_client_id IS NULL
     OR c.deleted_at IS NOT NULL
     OR c.status = 'INATIVO'
     OR COALESCE(c.honorarios_mensais, 0) <= 0
     OR mr.rn > 1
)
UPDATE financial_transactions ft
SET deleted_at = NOW(), updated_at = NOW()
FROM target
WHERE ft.id = target.id;
SQL
```

---

### Passo 6 — Verificar e completar honorários por competência (obrigatório)

Este passo deve ser executado **sempre** após os reparos para garantir que todos os clientes elegíveis têm lançamentos em todos os meses ativos.

#### 6.1. Verificar totais atuais

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "
SELECT
  (SELECT count(*) FROM clients
   WHERE deleted_at IS NULL AND status NOT IN ('INATIVO')
     AND gerar_lancamentos_honorarios IS TRUE
     AND COALESCE(honorarios_mensais, 0) > 0
  ) AS clientes_elegiveis,
  (SELECT count(*) FROM financial_transactions
   WHERE deleted_at IS NULL AND reference_month = DATE '2026-03-01'
     AND transaction_type = 'DESPESA' AND description LIKE 'Honorários do escritório - %'
  ) AS mar_despesas,
  (SELECT count(*) FROM financial_transactions
   WHERE deleted_at IS NULL AND reference_month = DATE '2026-03-01'
     AND client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
     AND transaction_type = 'RECEITA' AND description LIKE 'Honorários - %' AND notes LIKE '%Cliente:%'
  ) AS mar_receitas,
  (SELECT count(*) FROM financial_transactions
   WHERE deleted_at IS NULL AND reference_month = DATE '2026-04-01'
     AND transaction_type = 'DESPESA' AND description LIKE 'Honorários do escritório - %'
  ) AS abr_despesas,
  (SELECT count(*) FROM financial_transactions
   WHERE deleted_at IS NULL AND reference_month = DATE '2026-04-01'
     AND client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
     AND transaction_type = 'RECEITA' AND description LIKE 'Honorários - %' AND notes LIKE '%Cliente:%'
  ) AS abr_receitas;
"
```

Todos os valores devem ser iguais a `clientes_elegiveis`. Se algum campo estiver abaixo, executar o passo 6.2.

#### 6.2. Completar honorários faltantes para um mês específico

Substituir `YYYY-MM-01` e `MM/YYYY` pelo mês alvo:

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db << 'SQL'
-- Inserir DESPESAs faltantes
INSERT INTO financial_transactions (
  id, client_id, transaction_type, description, amount, due_date,
  reference_month, payment_status, notes, created_by_id, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  c.id,
  'DESPESA',
  'Honorários do escritório - MM/YYYY',
  c.honorarios_mensais,
  DATE 'YYYY-MM-01' + LEAST(c.dia_vencimento - 1, 27),
  DATE 'YYYY-MM-01',
  'PENDENTE',
  'Gerado automaticamente em ' || to_char(NOW(), 'DD/MM/YYYY') || ' (honorários recorrentes).',
  'c1208a34-d034-4afd-9a3d-d956c8e9bd67',
  NOW(), NOW()
FROM clients c
WHERE c.deleted_at IS NULL
  AND c.status NOT IN ('INATIVO')
  AND c.gerar_lancamentos_honorarios IS TRUE
  AND COALESCE(c.honorarios_mensais, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM financial_transactions ft
    WHERE ft.deleted_at IS NULL
      AND ft.client_id = c.id
      AND ft.reference_month = DATE 'YYYY-MM-01'
      AND ft.transaction_type = 'DESPESA'
      AND ft.description LIKE 'Honorários do escritório - %'
  );

-- Inserir RECEITAs faltantes
INSERT INTO financial_transactions (
  id, client_id, transaction_type, description, amount, due_date,
  reference_month, payment_status, notes, created_by_id, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104',
  'RECEITA',
  'Honorários - ' || c.razao_social || ' (' || c.cnpj || ') - MM/YYYY',
  c.honorarios_mensais,
  DATE 'YYYY-MM-01' + LEAST(c.dia_vencimento - 1, 27),
  DATE 'YYYY-MM-01',
  'PENDENTE',
  'Gerado automaticamente em ' || to_char(NOW(), 'DD/MM/YYYY') || ' (honorários recorrentes). Cliente: ' || c.id::text,
  'c1208a34-d034-4afd-9a3d-d956c8e9bd67',
  NOW(), NOW()
FROM clients c
WHERE c.deleted_at IS NULL
  AND c.status NOT IN ('INATIVO')
  AND c.gerar_lancamentos_honorarios IS TRUE
  AND COALESCE(c.honorarios_mensais, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM financial_transactions ft
    WHERE ft.deleted_at IS NULL
      AND ft.client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
      AND ft.reference_month = DATE 'YYYY-MM-01'
      AND ft.transaction_type = 'RECEITA'
      AND ft.description LIKE 'Honorários - %'
      AND ft.notes LIKE '%' || c.id::text || '%'
  );
SQL
```

---

### Passo 7 — Validação final

```bash
# Health da API
curl -s http://127.0.0.1:8000/api/v1/health
# Esperado: {"status":"ok","message":"API is running"}

# Status dos containers
docker ps --format 'table {{.Names}}\t{{.Status}}'
# Esperado: todos Up, postgres healthy

# Web
curl -s -o /dev/null -w 'WEB: %{http_code}\n' http://localhost:3000
# Esperado: WEB: 307
```

---

### Rollback rápido

Se o deploy falhar após o restart dos containers:

```bash
cd /home/deploy/apps/contabil
git log --oneline -5
git checkout HASH_ANTERIOR
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
```

Se precisar restaurar o banco (backup em plain text):

```bash
docker exec contabil-postgres-prod psql -U contabil -d postgres -c "DROP DATABASE contabil_db;"
docker exec contabil-postgres-prod psql -U contabil -d postgres -c "CREATE DATABASE contabil_db;"
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db < backups/NOME_DO_BACKUP.sql
```

---

## Estado do banco após o deploy de 2026-03-30

| Competência | Despesas | Receitas | Clientes elegíveis |
|-------------|----------|----------|--------------------|
| 2026-03-01  | 90       | 93       | 93                 |
| 2026-04-01  | 93       | 93       | 93                 |
| 2026-05-01  | 0        | 0        | —                  |

Backup pré-deploy: `backup_20260330_124153_before_deploy_20260330.sql` (2.5 MB)
