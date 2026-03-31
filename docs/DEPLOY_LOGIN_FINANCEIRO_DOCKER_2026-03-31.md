# Deploy: Login, Financeiro e Docker

Data base: `2026-03-31`

Documento para a proxima atualizacao do servidor com todas as alteracoes aplicadas localmente nas entregas de login, financeiro e infraestrutura Docker.

## Historico de execucao

| Data       | Commit  | Resultado                                                        |
|------------|---------|------------------------------------------------------------------|
| 2026-03-31 | 06c466c | Executado com sucesso apos hotfix de NEXT_PUBLIC_API_URL         |

### O que foi entregue

- Login auth-aware: sem sessao vai para `/login`, admin/func vai para `/clientes`, cliente vai para `/financeiro`
- Redirecionamento pos-login centralizado em `default-route.ts`
- Honorarios automaticos: pay/edit/delete na aba Escritorio
- Despesas nao pagas nascem em Contas a Pagar (PENDENTE, sem paid_date)
- KPI dinamico Lucro Liquido / Prejuizo no escritorio
- Docker local sobe postgres + api + web via `docker-compose.yml`
- Correcao do proxy de login: `INTERNAL_API_URL=http://api:8000/api/v1` no container web

### Problemas encontrados durante o deploy

#### Problema 1 — NEXT_PUBLIC_API_URL com /v1 quebra o nginx (CRITICO)

**Causa raiz**: o nginx roteia `/api/` para o FastAPI adicionando o prefixo `/v1/` automaticamente:

```nginx
location /api/ {
    proxy_pass http://api_backend/api/v1/;
}
```

Se `NEXT_PUBLIC_API_URL=https://cicgestao.com/api/v1`, o browser chama `/api/v1/auth/login`.
O nginx bate no bloco mais especifico `/api/v1/auth/login` com `proxy_pass http://api_backend/api/v1/`
e o caminho fica `/api/v1/` (raiz da API) — o login retorna erro silencioso.
Para todas as outras rotas (`/api/v1/users/me`, etc.), o nginx duplica o prefixo:
`/api/` strip → `v1/users/me` → proxy para `/api/v1/v1/users/me` — 404.

**Sintoma**: usuario nao consegue logar mesmo com credenciais corretas. Sem mensagem clara de erro.
A API responde 200 em testes diretos (porta 8000 ou 3000), mas nao via browser (nginx).

**Correcao aplicada no servidor**:

```bash
sed -i 's|NEXT_PUBLIC_API_URL=https://cicgestao.com/api/v1|NEXT_PUBLIC_API_URL=https://cicgestao.com/api|g' \
  /home/deploy/apps/contabil/.env.prod
```

Seguido de rebuild e restart do container `web`.

**Regra permanente para proximos deploys**:

> `NEXT_PUBLIC_API_URL` deve ser sempre `https://cicgestao.com/api` (SEM `/v1`).
> O nginx adiciona `/v1` automaticamente. Nunca inclua `/v1` nessa variavel.

Verificar antes de todo rebuild:

```bash
grep 'NEXT_PUBLIC_API_URL' /home/deploy/apps/contabil/.env.prod
# Esperado: NEXT_PUBLIC_API_URL=https://cicgestao.com/api
# ERRADO:   NEXT_PUBLIC_API_URL=https://cicgestao.com/api/v1
```

#### Problema 2 — Senha do admin nao pode ser resetada durante o deploy

Durante o diagnostico, a senha do admin foi temporariamente alterada.
A senha original foi restaurada a partir do backup (`backup_20260331_173805_*.sql`).

**Regra**: nunca resetar senhas de usuarios durante deploys.
Se precisar diagnosticar login, usar o backup para extrair o hash e restaurar.

#### Problema 3 — INTERNAL_API_URL nao estava no .env.prod

A variavel `INTERNAL_API_URL=http://api:8000/api/v1` nao existia no `.env.prod` do servidor.
Foi adicionada via `sed` antes do rebuild. Sem ela, o proxy interno do container `web`
tentava resolver `localhost:8000` (o proprio container) e retornava `ECONNREFUSED` no login.

Adicionar ao `.env.prod` caso nao exista:

```bash
grep -q 'INTERNAL_API_URL' /home/deploy/apps/contabil/.env.prod || \
  echo 'INTERNAL_API_URL=http://api:8000/api/v1' >> /home/deploy/apps/contabil/.env.prod
```

---

## Resumo executivo

Escopo desta atualizacao:

- corrigir a entrada do sistema para sempre respeitar autenticacao e perfil do usuario
- alinhar o redirecionamento pos-login entre middleware e tela de login
- corrigir fluxos do modulo financeiro para escritorio, funcionario e cliente
- separar honorario automatico de honorario manual
- habilitar baixa, edicao e exclusao de honorarios automaticos na aba `Escritorio`
- fazer despesas nao pagas nascerem em `Contas a Pagar`
- tornar o KPI do escritorio dinamico entre `Lucro Liquido` e `Prejuizo`
- subir `frontend`, `backend` e banco no Docker sem iniciar o front manualmente
- corrigir o proxy interno do login no container `web` para eliminar `500 Internal Server Error`

## O que foi alterado

### 1. Login e rotas iniciais

- `/` agora e auth-aware:
  - sem sessao: redireciona para `/login`
  - com sessao `admin` ou `func`: redireciona para `/clientes`
  - com sessao `cliente`: redireciona para `/financeiro`
- a regra passou a ser centralizada em `apps/web/src/lib/auth/default-route.ts`
- `middleware` e tela de login usam a mesma regra de destino

Arquivos principais:

- `apps/web/app/page.tsx`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/auth/default-route.ts`

### 2. Financeiro comum: baixa, edicao e exclusao

- baixa individual de lancamentos comuns padronizada em `POST /finance/{id}/pay`
- `cliente` so pode dar baixa em lancamento proprio
- `admin` e `func` podem dar baixa em lancamentos comuns
- `DELETE /finance/{id}` e `POST /finance/bulk/delete` foram revisados para nao tratar honorario manual como automatico

Arquivos principais:

- `apps/api/app/api/v1/routes/finance.py`
- `apps/api/app/services/finance/transaction_service.py`

### 3. Honorarios automaticos x manuais

- honorario automatico passou a ser identificado por marcador explicito, nao por prefixo solto da descricao
- regras de deteccao consolidadas em `apps/api/app/services/finance/honorarios_utils.py`
- honorario manual continua no CRUD comum
- honorario automatico segue no fluxo pareado escritorio + cliente

### 4. Honorarios na aba Escritorio

Novos endpoints para operar o par automatico:

- `POST /finance/fees/{office_transaction_id}/pay`
- `PUT /finance/fees/{office_transaction_id}`
- `DELETE /finance/fees/{office_transaction_id}`

Comportamento:

- `pay`: baixa sincronizada no par
- `edit`: sincroniza valor, vencimento e campos permitidos
- `delete`: reaproveita a logica de bloqueio da exclusao em massa
- descricao e competencia permanecem travadas para honorarios automaticos

Arquivos principais:

- `apps/api/app/api/v1/routes/finance.py`
- `apps/api/app/services/finance/fee_generator_service.py`
- `apps/api/app/schemas/finance.py`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/lib/api/endpoints/finance.ts`
- `apps/web/src/types/finance.ts`

### 5. Contas a pagar

- lancamento rapido de `Saida` nao paga agora nasce com `payment_status = PENDENTE`
- `paid_date = null`
- `payment_method = null`
- isso vale para escritorio e cliente
- resultado: despesa nao paga vai para `Contas a Pagar` e so entra em `Despesas` apos baixa

Arquivos principais:

- `apps/web/src/components/features/financeiro/ClienteLancamentoRapidoCard.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroPorEmpresa.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroLancamentos.tsx`

### 6. KPI dinamico

- no escritorio:
  - valor positivo: `Lucro Liquido`
  - valor negativo: `Prejuizo`
- label, cor, icone e estilo passam a refletir o sinal

Arquivo principal:

- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`

### 7. Docker local

- o `docker-compose.yml` raiz agora sobe:
  - `postgres`
  - `api`
  - `web`
- o `web` inicia sempre em `Turbopack`
- o container `web` instala dependencias no boot para popular os volumes de `node_modules`
- o contexto de build foi reduzido com `.dockerignore`

Arquivos principais:

- `docker-compose.yml`
- `infra/docker/Dockerfile.web`
- `.dockerignore`
- `package.json`
- `README.md`

### 8. Correcao do erro de login no Docker

Causa raiz encontrada:

- no navegador, o frontend chamava `/api/v1/...`
- o Next fazia rewrite para `http://localhost:8000/...`
- dentro do container `web`, `localhost` apontava para o proprio container, nao para o `api`
- resultado: `500 Internal Server Error` no login, com `ECONNREFUSED` nos logs do `web`

Correcao aplicada:

- `next.config.ts` passou a usar `INTERNAL_API_URL` para o rewrite interno
- `docker-compose.yml` passou a injetar `INTERNAL_API_URL=http://api:8000/api/v1`
- `docker-compose.prod.yml` e `infra/docker/Dockerfile.web.prod` foram alinhados com a mesma variavel
- `.env.example` e `.env.prod.example` agora documentam `INTERNAL_API_URL`

Arquivos principais:

- `apps/web/next.config.ts`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `infra/docker/Dockerfile.web.prod`
- `.env.example`
- `.env.prod.example`

## Impacto em banco de dados

- nao ha migration nova nesta entrega
- nao e necessario rodar `alembic upgrade head` por mudanca estrutural desta atualizacao
- mesmo assim, manter o passo de verificacao do `alembic current` por seguranca operacional

Observacao operacional:

- no ambiente validado, o banco nao estava vazio
- havia dados em tabelas como `financial_transactions`, `audit_logs`, `users` e `clients`
- portanto, tratar a proxima atualizacao como deploy sobre banco com dados reais
- backup antes de qualquer restart continua obrigatorio

## Ajustes obrigatorios no servidor

### Variavel nova

Adicionar em `.env.prod`:

```env
INTERNAL_API_URL=http://api:8000/api/v1
```

### Compose de producao

Garantir que o `web` receba `INTERNAL_API_URL`:

- em `build.args`
- em `environment`

Isso ja ficou registrado no repositório em `docker-compose.prod.yml`.

## Procedimento recomendado para a proxima atualizacao do servidor

### 1. Backup

```bash
ssh root@72.60.5.58
cd /home/deploy/apps/contabil
mkdir -p backups
docker exec contabil-postgres-prod pg_dump -U contabil -d contabil_db --no-owner --no-acl \
  > backups/backup_$(date +%Y%m%d_%H%M%S)_before_login_finance_docker.sql
ls -lh backups/ | tail -3
```

### 2. Atualizar codigo

```bash
cd /home/deploy/apps/contabil
git fetch origin
git pull origin Main
git log --oneline -5
```

### 3. Conferir configuracao obrigatoria

Revisar `.env.prod` e confirmar:

```env
NEXT_PUBLIC_API_URL=https://cicgestao.com/api
INTERNAL_API_URL=http://api:8000/api/v1
NEXT_PUBLIC_WS_URL=wss://cicgestao.com/ws
NEXT_PUBLIC_OFFICE_CLIENT_ID=522d5b00-2a4d-4f5a-8913-5d4ee0cf8104
```

### 4. Verificar revisao de banco

Esta entrega nao cria migration nova, mas validar o head atual evita subir codigo em ambiente parcialmente desatualizado.

```bash
cd /home/deploy/apps/contabil/apps/api
docker compose -f ../../docker-compose.prod.yml exec -T api alembic current
```

### 5. Rebuild e restart

```bash
cd /home/deploy/apps/contabil
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
docker compose -f docker-compose.prod.yml ps
```

Resultado esperado:

- `postgres` em `healthy`
- `api` em `Up`
- `web` em `Up`

## Smoke test obrigatorio apos o deploy

### 1. Health da API

```bash
curl -s https://cicgestao.com/api/v1/health
```

### 2. Redirecionamento inicial

```bash
curl -I https://cicgestao.com/
curl -I https://cicgestao.com/login
```

Esperado:

- acesso publico cai em `/login`
- pagina de login responde `200`

### 3. Login via rota publica

```bash
curl -X POST https://cicgestao.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@contabil.com","password":"admin123"}'
```

Esperado:

- `access_token`
- `refresh_token`
- objeto `user`

### 4. Validar proxy interno do web

Se houver acesso shell ao host:

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@contabil.com","password":"admin123"}'
```

Esperado:

- resposta `200`
- nao pode aparecer `ECONNREFUSED` do `web` para `localhost:8000`

### 5. Smoke test funcional do financeiro

No sistema:

- entrar sem sessao e confirmar redirecionamento para `/login`
- logar como `admin` ou `func` e confirmar destino em `/clientes`
- logar como `cliente` e confirmar destino em `/financeiro`
- no escritorio, criar `Saida` nao paga e confirmar:
  - entra em `Contas a Pagar`
  - nao soma em `Despesas`
- dar baixa em lancamento futuro no escritorio
- dar baixa em lancamento futuro no cliente
- na aba `Escritorio`, testar honorario automatico:
  - editar
  - excluir
  - dar baixa
- no KPI do escritorio:
  - valor positivo mostra `Lucro Liquido`
  - valor negativo mostra `Prejuizo`

## Logs uteis

```bash
cd /home/deploy/apps/contabil
docker compose -f docker-compose.prod.yml logs --tail=200 api
docker compose -f docker-compose.prod.yml logs --tail=200 web
```

Sinais de sucesso:

- `api` sem erro de autenticacao nem stacktrace no login
- `web` sem `Failed to proxy http://localhost:8000/...`
- `web` servindo a tela de login normalmente

## Rollback

Se o problema for apenas codigo:

```bash
cd /home/deploy/apps/contabil
git log --oneline -5
git checkout <commit_estavel>
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
```

Se o problema envolver dados, restaurar o backup gerado no passo 1.

## Arquivos-chave desta entrega

- `apps/api/app/api/v1/routes/finance.py`
- `apps/api/app/schemas/finance.py`
- `apps/api/app/services/finance/fee_generator_service.py`
- `apps/api/app/services/finance/transaction_service.py`
- `apps/api/app/services/finance/honorarios_utils.py`
- `apps/web/app/page.tsx`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/next.config.ts`
- `apps/web/src/lib/auth/default-route.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroPorEmpresa.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroLancamentos.tsx`
- `apps/web/src/components/features/financeiro/ClienteLancamentoRapidoCard.tsx`
- `apps/web/src/lib/api/endpoints/finance.ts`
- `apps/web/src/types/finance.ts`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `infra/docker/Dockerfile.web`
- `infra/docker/Dockerfile.web.prod`
- `.env.example`
- `.env.prod.example`

## Estado final validado localmente

- `POST http://localhost:3000/api/v1/auth/login` respondeu `200`
- `GET http://localhost:3000/api/v1/users/me` respondeu `200` autenticado
- `docker compose ps` mostrou `postgres`, `api` e `web` em execucao
- `web` subiu em `Next.js 16.0.10 (Turbopack)` no ambiente Docker local
