# Deploy das Atualizacoes do Financeiro - 2026-03-30

## Escopo

Este deploy cobre as seguintes mudancas:

- recriacao da logica mensal de honorarios por competencia;
- reparo de lancamentos de honorarios gerados um mes a frente;
- limpeza dos lotes indevidos de marco/2026 e maio/2026;
- correcao da listagem do financeiro para que `Mês de referência` use sempre `reference_month`;
- formulario de lancamento rapido para cliente na aba `Por Empresa`;
- ajustes do filtro mensal em todas as tabs do modulo financeiro.

## Pre-requisitos

- acesso SSH ao servidor;
- repositorio atualizado em `/opt/contabilconsult`;
- Docker e Docker Compose operacionais;
- containers de producao definidos em `docker-compose.prod.yml`.

## 1. Backup antes do deploy

```bash
ssh root@SEU_SERVIDOR
cd /opt/contabilconsult

mkdir -p backups
TIMESTAMP=$(date +%F_%H-%M)
docker exec -t contabil-postgres-prod \
  pg_dump -U contabil -F c -d contabil_db \
  > backups/contabil_db_${TIMESTAMP}.dump
```

## 2. Atualizar o codigo

```bash
cd /opt/contabilconsult
git fetch --all
git checkout Main
git pull origin Main
```

## 3. Rebuild e restart da aplicacao

```bash
cd /opt/contabilconsult
docker compose -f docker-compose.prod.yml up -d --build api web
docker compose -f docker-compose.prod.yml ps
```

## 4. Reparos obrigatorios no banco

### 4.1. Corrigir honorarios gravados um mes a frente

Executar o script do backend dentro do container da API:

```bash
cd /opt/contabilconsult
docker compose -f docker-compose.prod.yml exec api \
  python -m scripts.repair_honorarios_competencia
```

Observacao:
- o script corrige os casos deslocados para o mes seguinte e informa conflitos;
- se houver conflitos, eles devem ser revisados antes de seguir para o fechamento manual.

### 4.2. Arquivar o lote bugado de maio/2026 criado em 25/03/2026

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db <<'SQL'
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
SET deleted_at = NOW(),
    updated_at = NOW()
FROM target
WHERE ft.id = target.id;
SQL
```

### 4.3. Limpar residuos de marco/2026 para fechar no total de clientes elegiveis

Este passo remove:

- honorarios de clientes nao elegiveis (`INATIVO` ou `honorarios_mensais <= 0`);
- duplicatas antigas do mesmo cliente na competencia `2026-03-01`, mantendo a mais recente.

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db <<'SQL'
WITH march_ranked AS (
  SELECT
    ft.id,
    ft.transaction_type,
    CASE
      WHEN ft.transaction_type = 'DESPESA' THEN ft.client_id
      ELSE regexp_replace(ft.notes, '.*Cliente: ([0-9a-f-]+).*', '\1')::uuid
    END AS related_client_id,
    row_number() OVER (
      PARTITION BY
        CASE
          WHEN ft.transaction_type = 'DESPESA' THEN ft.client_id
          ELSE regexp_replace(ft.notes, '.*Cliente: ([0-9a-f-]+).*', '\1')::uuid
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
  JOIN clients c ON c.id = mr.related_client_id
  WHERE c.deleted_at IS NOT NULL
     OR c.status = 'INATIVO'
     OR COALESCE(c.honorarios_mensais, 0) <= 0
     OR mr.rn > 1
)
UPDATE financial_transactions ft
SET deleted_at = NOW(),
    updated_at = NOW()
FROM target
WHERE ft.id = target.id;
SQL
```

## 5. Validacao obrigatoria apos o deploy

### 5.1. Health check

```bash
curl -f http://127.0.0.1:8000/api/v1/health
docker compose -f docker-compose.prod.yml ps
```

### 5.2. Validar total de clientes elegiveis

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db <<'SQL'
SELECT count(*) AS eligible_total
FROM clients
WHERE deleted_at IS NULL
  AND status <> 'INATIVO'
  AND gerar_lancamentos_honorarios IS TRUE
  AND COALESCE(honorarios_mensais, 0) > 0;
SQL
```

Resultado esperado na data desta atualizacao:

```text
eligible_total = 93
```

### 5.3. Validar honorarios por competencia

```bash
docker exec -i contabil-postgres-prod psql -U contabil -d contabil_db <<'SQL'
SELECT DATE '2026-03-01' AS reference_month,
  (
    SELECT count(*)
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND reference_month = DATE '2026-03-01'
      AND transaction_type = 'DESPESA'
      AND description LIKE 'Honorários do escritório - %'
  ) AS client_expenses,
  (
    SELECT count(*)
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND reference_month = DATE '2026-03-01'
      AND client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
      AND transaction_type = 'RECEITA'
      AND description LIKE 'Honorários - %'
      AND notes LIKE '%Cliente:%'
  ) AS office_revenues
UNION ALL
SELECT DATE '2026-04-01',
  (
    SELECT count(*)
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND reference_month = DATE '2026-04-01'
      AND transaction_type = 'DESPESA'
      AND description LIKE 'Honorários do escritório - %'
  ),
  (
    SELECT count(*)
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND reference_month = DATE '2026-04-01'
      AND client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
      AND transaction_type = 'RECEITA'
      AND description LIKE 'Honorários - %'
      AND notes LIKE '%Cliente:%'
  )
UNION ALL
SELECT DATE '2026-05-01',
  (
    SELECT count(*)
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND reference_month = DATE '2026-05-01'
      AND transaction_type = 'DESPESA'
      AND description LIKE 'Honorários do escritório - %'
  ),
  (
    SELECT count(*)
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND reference_month = DATE '2026-05-01'
      AND client_id = '522d5b00-2a4d-4f5a-8913-5d4ee0cf8104'
      AND transaction_type = 'RECEITA'
      AND description LIKE 'Honorários - %'
      AND notes LIKE '%Cliente:%'
  );
SQL
```

Resultado esperado:

```text
2026-03-01 | 93 | 93
2026-04-01 | 93 | 93
2026-05-01 |  0 |  0
```

### 5.4. Validar API da listagem por competencia

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@contabil.com","password":"admin123"}'
```

Com o `access_token` retornado, validar:

```bash
curl -s "http://127.0.0.1:8000/api/v1/finance?client_id=522d5b00-2a4d-4f5a-8913-5d4ee0cf8104&reference_month=2026-04-01&skip=0&limit=100" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

Resultado esperado:

```text
total = 93
items = 93
```

### 5.5. Validacao visual no navegador

Em `/financeiro`:

- tab `Escritório`, filtro `abril de 2026`: `Honorários dos Clientes` deve mostrar `93 lançamento(s)`;
- tab `Por Empresa`: formulario `Novo lançamento` visivel e funcional;
- filtro mensal funcionando nas tabs `Escritório`, `Por Empresa` e `Lançamentos`;
- sem honorarios adiantados em `maio de 2026`.

## 6. Rollback rapido

Se o deploy falhar:

```bash
cd /opt/contabilconsult
git log --oneline -5
git checkout HASH_ANTERIOR
docker compose -f docker-compose.prod.yml up -d --build api web
```

Se precisar restaurar o banco:

```bash
docker exec -i contabil-postgres-prod pg_restore \
  -U contabil \
  -d contabil_db \
  --clean \
  < backups/NOME_DO_BACKUP.dump
```

