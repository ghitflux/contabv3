# Deploy - Novo Lancamento Distribuicao de Lucros - 2026-05-18

## Objetivo

Adicionar a opcao "Distribuicao de lucros" no modal `NovoLancamentoModal` para que o
formulario "Novo Lancamento" da aba `Por Empresa` / `Minha Empresa` aceite o mesmo
tipo de lancamento ja disponivel no formulario inline do escritorio e no card de
lancamento rapido dos clientes.

Antes desta correcao, o usuario do nivel cliente nao tinha acesso ao tipo
"Distribuicao de Lucros" pelo botao `Novo Lancamento` do modulo Financeiro, mesmo
com a opcao presente no card inline e na aba Escritorio.

Este deploy nao altera schema de banco e nao exige migration.

---

## Escopo funcional

- O Select "Tipo de Transacao" do `NovoLancamentoModal` passa a oferecer:
  - Receita;
  - Despesa;
  - Distribuicao de lucros (novo);
  - Aplicacao financeira;
  - Resgate de aplicacao.
- Ao selecionar "Distribuicao de lucros", o modal:
  - envia `transaction_type = despesa`;
  - grava `category = distribuicao_lucros` (mesma regra do escritorio);
  - oculta o seletor de "Tipo de Categoria" e o campo de categoria personalizada,
    ja que a categoria e fixa para distribuicao.
- A logica preserva a regra de nao misturar distribuicao com despesa operacional.

---

## Arquivos do pacote

- `apps/web/src/components/features/financeiro/NovoLancamentoModal.tsx`
- `docs/DEPLOY_NOVO_LANCAMENTO_DISTRIBUICAO_LUCROS_2026-05-18.md`

---

## Validacao local realizada

Frontend:

```bash
pnpm --dir apps/web exec tsc --noEmit
```

Resultado:

```text
tsc --noEmit finalizado sem erros
```

Validacao manual (usuario):

- abriu `Por Empresa`, clicou em `Novo Lancamento`;
- confirmou que a opcao "Distribuicao de lucros" aparece no Select de Tipo;
- criou um lancamento de distribuicao e confirmou que o registro ficou correto.

Nao foram executadas migrations porque o pacote nao muda banco de dados.

---

## Pre-deploy

- commit enviado ao remoto;
- producao usa `docker-compose.prod.yml` e `.env.prod`;
- backup do banco antes do deploy;
- nao substituir `.env.prod` por `.env` local.

---

## Deploy via Paramiko (executado)

```python
import paramiko
HOST = "72.60.5.58"
USER = "root"
PROJECT_DIR = "/home/deploy/apps/contabil"

commands = [
    f"mkdir -p {PROJECT_DIR}/backups && "
    f"docker exec contabil-postgres-prod pg_dump -U contabil contabil_db > "
    f"{PROJECT_DIR}/backups/backup_$(date +%Y%m%d_%H%M%S).sql",
    f"cd {PROJECT_DIR} && git fetch origin && git pull --ff-only origin Main",
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml "
    f"--env-file .env.prod build --no-cache web",
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml "
    f"--env-file .env.prod up -d --force-recreate web",
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml "
    f"--env-file .env.prod ps",
]
```

---

## Validacao pos-deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker logs contabil-web-prod --tail 20
docker logs contabil-api-prod --tail 20
curl -s -o /dev/null -w 'API: %{http_code}\n' http://127.0.0.1:8000/api/v1/health
curl -s -o /dev/null -w 'WEB: %{http_code}\n' http://127.0.0.1:3000
```

### Validacao funcional

1. Entrar no sistema com usuario `admin` ou `func`.
2. Abrir `Financeiro` -> aba `Por Empresa`.
3. Selecionar um cliente.
4. Clicar em `Novo Lancamento`.
5. Confirmar que o Select "Tipo de Transacao" oferece "Distribuicao de lucros".
6. Criar um lancamento de distribuicao e validar que:
   - o registro aparece nos lancamentos do cliente;
   - o KPI "Distribuicao de Lucros" reflete o valor;
   - o lancamento nao entra no card de "Despesas" operacionais.
7. Repetir o passo com usuario `cliente` em `Minha Empresa`.

---

## Rollback

```bash
cd /home/deploy/apps/contabil
git log --oneline -5
git revert --no-edit <COMMIT_DESTE_DEPLOY>
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache web
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate web
```

Como nao ha migration, o rollback e limitado ao frontend/documentacao.

---

## Checklist final

- [x] Commit enviado ao remoto.
- [x] Backup do banco antes do deploy.
- [x] Servidor atualizado com `git pull --ff-only`.
- [x] Frontend reconstruido com `build --no-cache web`.
- [x] Container `web` reiniciado.
- [x] `Novo Lancamento` em `Por Empresa` valida com `admin/func`.
- [ ] Validacao com usuario `cliente` em `Minha Empresa`, se aplicavel.
- [x] Distribuicao de lucros fora de despesa operacional.
