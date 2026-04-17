# Deploy - Correções do Financeiro - 2026-04-17

## Objetivo

Aplicar em produção o pacote de correções do módulo financeiro para:

- restabelecer a geração manual de honorários mesmo após exclusão anterior com bloqueio de competência;
- sincronizar a competência dos honorários com o filtro mensal exibido na tela;
- permitir prévia e geração coerentes para meses futuros no fluxo de recorrência;
- corrigir a persistência dos históricos personalizados do escritório;
- remover `Distribuição de lucros` de `Despesas` e `Contas a pagar`;
- ampliar os presets de histórico/descrição nos formulários de lançamento;
- remover a exibição de `Conta contábil` no histórico de ações financeiras.

---

## Arquivos do pacote

- `apps/api/app/api/v1/routes/finance.py`
- `apps/api/app/services/finance/fee_generator_service.py`
- `apps/api/tests/unit/services/test_fee_generator_service.py`
- `apps/web/src/components/features/financeiro/ClienteLancamentoRapidoCard.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroHistoricoClientes.tsx`
- `apps/web/src/components/features/financeiro/NovoLancamentoModal.tsx`
- `apps/web/src/constants/financePresets.ts`
- `scripts/fix_honorarios_bloqueados.py`

---

## Impacto funcional

### 1. Honorários manuais

- `Prévia` e `Gerar honorários` passam a ignorar bloqueios antigos criados por exclusão manual.
- Se existir `monthly_fee_block` para a competência e o usuário gerar manualmente, o bloqueio é removido durante a operação.
- Isso preserva o bloqueio para a automação normal, mas não trava o reparo manual via interface.

### 2. Competência e filtros

- O seletor de competência da seção de honorários passa a acompanhar o filtro mensal principal da aba `Escritório`.
- Ao trocar a competência em honorários, o filtro principal também é atualizado para o mesmo mês.

### 3. Recorrência futura

- A API deixa de limitar a materialização de recorrências apenas ao mês atual.
- Agora a listagem pode gerar ocorrências faltantes até `12` meses à frente do mês corrente.
- Isso corrige o caso de uma despesa recorrente do dia `10` não aparecer ao consultar `05/2026`.

### 4. Históricos e formulários

- Históricos padrão do escritório agora são reidratados corretamente do `localStorage`.
- Os históricos novos são mesclados com os presets e não se perdem no reload.
- O lançamento rápido e o modal completo passam a sugerir descrições com base na lista financeira consolidada.

### 5. Distribuição de lucros

- Continua disponível como tipo próprio no escritório.
- Não entra mais no cálculo de `Despesas`.
- Não entra mais no balão/lista de `Contas a pagar`.

---

## Script de apoio operacional

Arquivo:

- `scripts/fix_honorarios_bloqueados.py`

Usar somente se já houver meses travados em produção por bloqueios antigos e for necessário saneamento em lote fora da interface.

Exemplo:

```bash
docker cp scripts/fix_honorarios_bloqueados.py contabil-api-prod:/tmp/fix_honorarios_bloqueados.py
docker exec contabil-api-prod python3 /tmp/fix_honorarios_bloqueados.py 2026-04
```

O script:

- remove registros de `monthly_fee_blocks` da competência;
- tenta regerar os honorários do mês para clientes elegíveis;
- reporta gerados, pulados e erros.

---

## Passo a passo de deploy

### 1. Backup

```bash
ssh root@SEU_SERVIDOR
cd /home/deploy/apps/contabil
mkdir -p backups/2026-04-17-financeiro

docker exec contabil-postgres-prod pg_dump -U contabil -d contabil_db --no-owner --no-acl \
  > backups/2026-04-17-financeiro/backup_before_finance_20260417_$(date +%H%M%S).sql

git rev-parse HEAD > backups/2026-04-17-financeiro/git_head_before.txt
git status --short > backups/2026-04-17-financeiro/git_status_before.txt
```

### 2. Atualizar código

```bash
cd /home/deploy/apps/contabil
git fetch origin
git pull origin Main
git log --oneline -3
```

### 3. Rebuild

```bash
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

### 4. Health check

```bash
curl -sS http://127.0.0.1:8000/api/v1/health
docker logs contabil-api-prod --tail=80
docker logs contabil-web-prod --tail=80
```

---

## Validação funcional pós-deploy

Executar no painel financeiro:

1. Aba `Escritório`:
   Selecionar `04/2026`, abrir `Honorários dos Clientes`, confirmar que a competência exibida bate com o filtro principal.

2. Excluir um honorário de teste e depois usar `Atualizar prévia` + `Gerar honorários`:
   O lançamento deve voltar a ser gerado para a mesma competência.

3. Lançar uma despesa recorrente com dia fixo `10` e consultar um mês futuro:
   A ocorrência futura deve aparecer em `Contas a pagar`.

4. Criar um histórico novo no escritório:
   Recarregar a página e validar que o histórico continua disponível.

5. Criar `Distribuição de lucros`:
   Validar que aparece no fluxo próprio, mas não aumenta `Despesas` nem `Contas a pagar`.

6. Abrir `Histórico`:
   Confirmar que atualizações de banco não exibem mais `Conta contábil`.

---

## Consultas úteis de conferência

### Verificar bloqueios de competência existentes

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "
SELECT reference_month, count(*)
FROM monthly_fee_blocks
GROUP BY reference_month
ORDER BY reference_month DESC;
"
```

### Verificar honorários de uma competência

```bash
docker exec contabil-postgres-prod psql -U contabil -d contabil_db -c "
SELECT
  reference_month,
  transaction_type,
  count(*)
FROM financial_transactions
WHERE deleted_at IS NULL
  AND reference_month = DATE '2026-04-01'
  AND (
    description LIKE 'Honorários - %'
    OR description LIKE 'Honorários do escritório - %'
  )
GROUP BY reference_month, transaction_type
ORDER BY transaction_type;
"
```

---

## Risco e rollback

### Risco principal

- o comportamento de geração manual de honorários agora remove bloqueio da competência quando necessário;
- isso é intencional para reparo manual, mas deve ser validado logo após o deploy.

### Rollback

Se houver regressão:

```bash
cd /home/deploy/apps/contabil
git log --oneline -5
git checkout COMMIT_ANTERIOR
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
```

Se houver necessidade de rollback de dados, restaurar o backup SQL gerado no passo 1.
