# Deploy - Atualizacoes de Relatorios e Financeiro - 2026-04-23 via Paramiko

## Objetivo

Aplicar no servidor o pacote de atualizacoes que envolve:

- novos tipos financeiros `aplicacao` e `resgate`;
- separacao de movimentos financeiros que nao devem compor receitas, despesas, DRE ou KPIs operacionais;
- relatorios estrategicos para escritorio e clientes;
- ajustes de exportacao e preview de relatorios;
- correcao de schema faltante em `clients.obligation_types_ids`;
- preservacao do comportamento de producao com `docker-compose.prod.yml` e `.env.prod`.

Este documento e o roteiro operacional para deploy remoto via Paramiko.

---

## Escopo funcional

### Financeiro

- Inclusao de `Aplicacao financeira` e `Resgate de aplicacao` como tipos de lancamento.
- Aplicacao e resgate sao movimentos financeiros, nao receita e nao despesa.
- `Distribuicao de lucros` permanece separada de despesas e contas a pagar.
- Lancamento rapido e lancamento completo passam a aceitar os novos tipos.
- Indicadores financeiros e relatorios nao devem misturar fluxo operacional com aplicacoes/resgates.

### Relatorios

- Novo tipo `geral` em `ReportType`.
- `/api/v1/reports/types` passa a listar 12 tipos, incluindo `Relatorio Geral`.
- Escritorio em `/relatorios`:
  - ve `Relatorio Geral`, `Relatorio de Clientes` e `Obrigacoes Mensais`;
  - `Relatorio Geral` abre por padrao no escopo do escritorio via `OFFICE_CLIENT_ID`;
  - permite cliente especifico ou consolidado quando aplicavel.
- Cliente em `/portal/relatorios`:
  - ve somente `Relatorio Geral` e `Obrigacoes Mensais`;
  - API limita os dados ao cliente autenticado.
- `Relatorio Geral` entrega:
  - dados da empresa;
  - resumo financeiro;
  - DRE simplificada;
  - KPIs;
  - evolucao mensal;
  - principais receitas e despesas;
  - projecao de receitas e despesas para 3 meses.
- `Relatorio de Clientes` entrega:
  - total de ativos;
  - agrupamento por regime tributario;
  - agrupamento por status;
  - tabela de clientes.
- `Relatorio de Obrigacoes` entrega:
  - obrigacoes por cliente;
  - status;
  - competencia;
  - totais por status.

### Docker local e login

- O ajuste local de login/Docker nao deve ser levado como alteracao de producao.
- Producao continua usando `docker-compose.prod.yml` e `.env.prod`.
- Nao substituir `.env.prod` por `.env` local.
- No servidor, a API deve falar com Postgres pela rede Docker usando host `postgres`, nao `localhost`.

---

## Arquivos principais do pacote

### Backend

- `apps/api/alembic/versions/20260423_0900_add_geral_report_type.py`
- `apps/api/alembic/versions/20260423_1000_add_missing_client_obligation_types_ids.py`
- `apps/api/app/db/models/finance.py`
- `apps/api/app/db/models/report.py`
- `apps/api/app/schemas/finance.py`
- `apps/api/app/schemas/report.py`
- `apps/api/app/api/v1/routes/reports.py`
- `apps/api/app/services/report/geral_report.py`
- `apps/api/app/services/report/client_report.py`
- `apps/api/app/services/report/obligation_report.py`
- `apps/api/app/services/report/cash_book_report.py`

### Frontend

- `apps/web/src/components/features/financeiro/ClienteLancamentoRapidoCard.tsx`
- `apps/web/src/components/features/financeiro/NovoLancamentoModal.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroLancamentos.tsx`
- `apps/web/src/components/features/relatorios/RelatoriosModule.tsx`
- `apps/web/src/components/features/relatorios/ReportPreviewRenderer.tsx`
- `apps/web/app/portal/relatorios/page.tsx`
- `apps/web/src/types/finance.ts`
- `apps/web/src/types/report.ts`
- `apps/web/src/lib/api/endpoints/finance.ts`

### Documentacao e testes

- `docs/contracts/report-api.md`
- `docs/MEMORIA_DOCKER_LOCAL_LOGIN_2026-04-23.md`
- `apps/api/tests/conftest.py`
- `apps/api/tests/integration/test_report_routes.py`

---

## Migrations obrigatorias

Head esperado apos deploy:

```text
20260423_client_obl_type_ids
```

Migrations novas:

1. `20260423_add_geral_report_type`
   - adiciona `geral` ao enum PostgreSQL `report_type`;
   - nao ha downgrade simples para remover valor de enum no PostgreSQL.

2. `20260423_client_obl_type_ids`
   - adiciona `clients.obligation_types_ids JSONB DEFAULT '[]'` com `IF NOT EXISTS`;
   - corrige drift de schema causado por migration antiga de janeiro que tinha `return` antes do `ALTER TABLE`;
   - e aditiva e segura para ambientes que ja tenham a coluna.

Comando obrigatorio no servidor:

```bash
docker compose -f docker-compose.prod.yml exec -T api alembic upgrade head
docker compose -f docker-compose.prod.yml exec -T api alembic current
```

---

## Validacao local ja realizada

Ambiente local Docker:

```text
ConsultContabil-api        Up healthy
ConsultContabil-postgres   Up healthy
ConsultContabil-web        Up
```

Banco local:

```text
alembic current -> 20260423_client_obl_type_ids (head)
```

Suite pytest do escopo de relatorios no container:

```bash
python -m pytest tests/integration/test_report_routes.py -q
```

Resultado:

```text
16 passed, 24 warnings
```

Observacao: as warnings sao deprecations Pydantic existentes.

Tambem foi validado:

- `GET /api/v1/reports/types` lista 12 tipos, incluindo `geral`;
- preview de `geral` retorna todas as secoes esperadas;
- usuario cliente fica restrito aos dados do proprio cliente;
- relatorio de clientes retorna ativos e agrupamentos;
- relatorio de obrigacoes respeita periodo, cliente e status;
- exportacao `geral` em PDF e CSV gera historico e arquivo baixavel.

---

## Pre-deploy

Antes de executar no servidor:

- gerar commit com todos os arquivos deste pacote;
- confirmar que o branch remoto esta atualizado;
- confirmar o diretorio remoto do projeto, normalmente `/home/deploy/apps/contabil`;
- confirmar que `.env.prod` existe no servidor e nao sera sobrescrito;
- confirmar `NEXT_PUBLIC_OFFICE_CLIENT_ID` e `OFFICE_CLIENT_ID` apontando para o cliente tecnico do escritorio;
- ter acesso SSH/Paramiko ao servidor;
- fazer backup do banco antes de recriar containers.

Variaveis de producao esperadas:

```env
DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@postgres:5432/NOME_DO_BANCO
DATABASE_WRITE_URL=postgresql+asyncpg://USUARIO:SENHA@postgres:5432/NOME_DO_BANCO
DATABASE_READ_URL=postgresql+asyncpg://USUARIO:SENHA@postgres:5432/NOME_DO_BANCO
INTERNAL_API_URL=http://api:8000/api/v1
NEXT_PUBLIC_API_URL=https://DOMINIO/api
NEXT_PUBLIC_APP_URL=https://DOMINIO
NEXT_PUBLIC_OFFICE_CLIENT_ID=522d5b00-2a4d-4f5a-8913-5d4ee0cf8104
OFFICE_CLIENT_ID=522d5b00-2a4d-4f5a-8913-5d4ee0cf8104
```

Nao usar `localhost` nas URLs de banco dentro da API em producao.

---

## Script Paramiko recomendado

Salvar localmente como `deploy_2026_04_23_paramiko.py` e executar a partir da maquina de operacao.

Usar variaveis de ambiente para credenciais:

```bash
export DEPLOY_HOST="IP_OU_HOST"
export DEPLOY_PORT="2222"
export DEPLOY_USER="deploy"
export DEPLOY_KEY="/caminho/para/chave.pem"
export DEPLOY_DIR="/home/deploy/apps/contabil"
export DEPLOY_BRANCH="Main"
python deploy_2026_04_23_paramiko.py
```

Script:

```python
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HOST = os.environ["DEPLOY_HOST"]
PORT = int(os.environ.get("DEPLOY_PORT", "22"))
USER = os.environ.get("DEPLOY_USER", "deploy")
KEY_PATH = os.environ.get("DEPLOY_KEY")
PASSWORD = os.environ.get("DEPLOY_PASSWORD")
REMOTE_DIR = os.environ.get("DEPLOY_DIR", "/home/deploy/apps/contabil")
BRANCH = os.environ.get("DEPLOY_BRANCH", "Main")


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs = {
        "hostname": HOST,
        "port": PORT,
        "username": USER,
        "timeout": 30,
    }
    if KEY_PATH:
        kwargs["key_filename"] = KEY_PATH
    if PASSWORD:
        kwargs["password"] = PASSWORD
    client.connect(**kwargs)
    return client


def run(client: paramiko.SSHClient, command: str) -> None:
    print(f"\n$ {command}\n")
    stdin, stdout, stderr = client.exec_command(command, get_pty=True)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    status = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        print(err)
    if status != 0:
        raise SystemExit(f"Command failed with status {status}: {command}")


deploy_commands = rf"""
set -euo pipefail
cd "{REMOTE_DIR}"

COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="backups/2026-04-23-relatorios-financeiro"
mkdir -p "$BACKUP_DIR"

echo "== pre deploy =="
git rev-parse HEAD > "$BACKUP_DIR/git_head_before.txt"
git status --short > "$BACKUP_DIR/git_status_before.txt"
$COMPOSE ps > "$BACKUP_DIR/compose_ps_before.txt"

echo "== backup postgres =="
$COMPOSE exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' \
  > "$BACKUP_DIR/backup_before_20260423_$(date +%Y%m%d_%H%M%S).sql"

echo "== update code =="
git fetch origin
git pull --ff-only origin "{BRANCH}"
git log --oneline -5

echo "== build images =="
$COMPOSE build --no-cache api web

echo "== recreate api/web =="
$COMPOSE up -d --force-recreate api web

echo "== migrations =="
$COMPOSE exec -T api alembic upgrade head
$COMPOSE exec -T api alembic current

echo "== status =="
$COMPOSE ps

echo "== health =="
curl -fsS http://127.0.0.1:8000/api/v1/health || curl -fsS http://127.0.0.1/api/v1/health

echo "== recent logs =="
$COMPOSE logs --tail=120 api
$COMPOSE logs --tail=80 web
"""


if __name__ == "__main__":
    ssh = connect()
    try:
        run(ssh, f"bash -lc {deploy_commands!r}")
    finally:
        ssh.close()
```

Observacao importante: manter o `TextIOWrapper(..., encoding="utf-8", errors="replace")` para evitar queda local do script em Windows quando a saida do Docker vier com caracteres UTF-8.

---

## Comandos manuais equivalentes no servidor

Usar caso o Paramiko falhe e seja necessario continuar via SSH.

```bash
cd /home/deploy/apps/contabil
COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="backups/2026-04-23-relatorios-financeiro"
mkdir -p "$BACKUP_DIR"

git rev-parse HEAD > "$BACKUP_DIR/git_head_before.txt"
git status --short > "$BACKUP_DIR/git_status_before.txt"
$COMPOSE ps > "$BACKUP_DIR/compose_ps_before.txt"

$COMPOSE exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' \
  > "$BACKUP_DIR/backup_before_20260423_$(date +%Y%m%d_%H%M%S).sql"

git fetch origin
git pull --ff-only origin Main
git log --oneline -5

$COMPOSE build --no-cache api web
$COMPOSE up -d --force-recreate api web

$COMPOSE exec -T api alembic upgrade head
$COMPOSE exec -T api alembic current

$COMPOSE ps
curl -fsS http://127.0.0.1:8000/api/v1/health || curl -fsS http://127.0.0.1/api/v1/health
$COMPOSE logs --tail=120 api
$COMPOSE logs --tail=80 web
```

---

## Conferencias SQL pos-deploy

### Alembic head

```bash
COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SELECT version_num FROM alembic_version;
SQL
```

Resultado esperado:

```text
20260423_client_obl_type_ids
```

### Enum `report_type`

```bash
COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'report_type'::regtype
ORDER BY enumsortorder;
SQL
```

Deve conter:

```text
geral
```

### Coluna corretiva em clientes

```bash
COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name = 'obligation_types_ids';
SQL
```

Deve retornar uma linha para `obligation_types_ids`.

---

## Smoke test funcional pos-deploy

### Login

- Acessar `/login`.
- Entrar com usuario valido do escritorio.
- Confirmar carregamento do dashboard.

### Financeiro

1. Abrir `Financeiro`.
2. Criar lancamento rapido como `Aplicacao`.
3. Criar lancamento completo como `Resgate`.
4. Baixar os dois lancamentos.
5. Confirmar que nao aumentam `Receitas`, `Despesas`, DRE nem margem de lucro.
6. Confirmar que ficam visiveis como movimentacoes financeiras.
7. Criar `Distribuicao de lucros` e confirmar que nao entra como despesa operacional.

### Relatorios do escritorio

1. Abrir `/relatorios`.
2. Confirmar cards estrategicos:
   - `Relatorio Geral`;
   - `Relatorio de Clientes`;
   - `Obrigacoes Mensais`.
3. Gerar `Relatorio Geral` no escopo escritorio.
4. Gerar `Relatorio Geral` consolidado.
5. Gerar `Relatorio de Clientes`.
6. Gerar `Obrigacoes Mensais`.
7. Exportar `Relatorio Geral` em PDF e CSV.
8. Confirmar historico e download do arquivo.

### Portal do cliente

1. Entrar com usuario cliente.
2. Abrir `/portal/relatorios`.
3. Confirmar que `Relatorio de Clientes` nao aparece.
4. Gerar `Relatorio Geral`.
5. Gerar `Obrigacoes Mensais`.
6. Confirmar que os dados pertencem somente ao cliente autenticado.

### API

```bash
curl -fsS http://127.0.0.1:8000/api/v1/reports/types
```

Validar que a resposta contem `geral` e total de 12 tipos.

---

## Riscos e cuidados

- `report_type` recebe novo valor de enum. Nao tentar remover `geral` em rollback simples.
- `clients.obligation_types_ids` e coluna aditiva e pode permanecer mesmo se o codigo voltar para versao anterior.
- Se o deploy parar antes da migration, nao validar o frontend novo contra API antiga.
- Se `NEXT_PUBLIC_OFFICE_CLIENT_ID` estiver ausente, relatorios e financeiro do escritorio podem mostrar alerta ou ficar sem escopo tecnico.
- `.env.prod` nao deve ser sobrescrito por variaveis locais.
- API em producao deve usar banco por `postgres:5432`, nao por `localhost:5432`.

---

## Rollback

Rollback de codigo:

```bash
cd /home/deploy/apps/contabil
git log --oneline -10
git checkout COMMIT_ANTERIOR_ESTAVEL
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d --force-recreate api web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=120 api
```

Observacoes:

- Nao rodar downgrade automatico para remover `geral` do enum PostgreSQL.
- Nao e necessario remover `clients.obligation_types_ids` em rollback de codigo.
- Se houver necessidade de rollback de dados, restaurar o dump criado no `BACKUP_DIR`.

---

## Checklist final

- [ ] Commit do pacote criado e enviado ao remoto.
- [ ] Backup SQL criado no servidor.
- [ ] `git pull --ff-only origin Main` executado.
- [ ] `docker compose -f docker-compose.prod.yml build --no-cache api web` concluido.
- [ ] `docker compose -f docker-compose.prod.yml up -d --force-recreate api web` concluido.
- [ ] `alembic current` retornou `20260423_client_obl_type_ids (head)`.
- [ ] API respondeu `/api/v1/health`.
- [ ] `/api/v1/reports/types` contem `geral`.
- [ ] Login validado.
- [ ] Financeiro validado com aplicacao/resgate fora de receitas/despesas.
- [ ] `/relatorios` validado no escritorio.
- [ ] `/portal/relatorios` validado com usuario cliente.
