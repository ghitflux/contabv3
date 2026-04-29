# Deploy - Financeiro Clientes KPIs e Lancamentos Rapidos - 2026-04-29

## Objetivo

Subir no servidor a atualizacao visual e funcional da aba de clientes do modulo Financeiro.

O pacote deixa a aba `Por Empresa` / `Minha Empresa` alinhada com a aba `Escritorio` em:

- secao de lancamento rapido;
- cards KPI do periodo;
- cards acumulados do ano;
- cards de contas a receber, contas a pagar e margem de lucro;
- regras de aplicacao, resgate e distribuicao de lucros.

Este deploy nao altera schema de banco e nao exige migration.

---

## Escopo funcional

### Financeiro - clientes

- `FinanceiroPorEmpresa` passa a usar o mesmo componente visual de KPIs do escritorio: `FinanceiroKPIs`.
- KPIs do periodo em clientes seguem a mesma logica do escritorio:
  - `Receita do Periodo`: somente receitas pagas.
  - `Despesas`: despesas pagas, excluindo distribuicao de lucros.
  - `Lucro Liquido` ou `Prejuizo`: receita menos despesa operacional.
  - `Aplicacoes Financeiras`: aplicacao e resgate liquidados com sinal financeiro.
  - `Distribuicao de Lucros`: pagamentos realizados no periodo.
- Cards acumulados do ano em clientes seguem o mesmo desenho do escritorio:
  - receita do ano;
  - despesa do ano;
  - lucro ou prejuizo do ano;
  - distribuicao no ano;
  - aplicacoes no ano.
- Cards auxiliares seguem o padrao do escritorio:
  - contas a receber;
  - contas a pagar;
  - margem de lucro atual.
- Clique nos KPIs filtra a tabela de detalhe do indicador correspondente.
- Distribuicao de lucros entra como painel proprio e continua fora de despesas operacionais.

### Lancamento rapido dos clientes

- `ClienteLancamentoRapidoCard` foi ajustado para ficar no mesmo padrao do formulario inline do escritorio.
- Tipos disponiveis:
  - Entrada;
  - Saida;
  - Distribuicao de lucros;
  - Aplicacao;
  - Resgate.
- Historicos passam a usar os presets padrao de `financePresets`.
- Botao `Novo Historico` permite criar historicos locais por tipo.
- Lancamento recorrente nasce pendente, mantendo o mesmo comportamento do escritorio.
- Distribuicao de lucros grava `category = distribuicao_lucros`, preservando a regra de nao misturar com despesa operacional.

---

## Arquivos do pacote

- `apps/web/src/components/features/financeiro/FinanceiroPorEmpresa.tsx`
- `apps/web/src/components/features/financeiro/ClienteLancamentoRapidoCard.tsx`
- `docs/DEPLOY_FINANCEIRO_CLIENTES_KPIS_LANCAMENTOS_2026-04-29.md`

Arquivos nao relacionados existentes no worktree local nao fazem parte deste deploy:

- `apps/api/.coverage`
- `.codex/`
- `debugs/`
- `docs/MEMORIA_DOCKER_LOCAL_LOGIN_2026-04-23.md`

---

## Validacao local realizada

Frontend:

```bash
pnpm --dir apps/web type-check
```

Resultado:

```text
tsc --noEmit finalizado sem erros
```

Nao foram executadas migrations porque o pacote nao muda banco de dados.

---

## Pre-deploy

Antes de executar no servidor:

- confirmar que este commit foi enviado ao remoto;
- confirmar diretorio remoto do projeto;
- confirmar que producao usa `docker-compose.prod.yml` e `.env.prod`;
- nao substituir `.env.prod` por `.env` local;
- garantir backup/snapshot operacional conforme rotina do servidor.

Comandos locais sugeridos:

```bash
git status --short
git log -1 --oneline
git push origin HEAD
```

---

## Deploy via Paramiko

Atualize as variaveis antes de executar:

```python
import paramiko

HOST = "SEU_HOST"
PORT = 22
USER = "SEU_USUARIO"
KEY_PATH = "/caminho/para/chave.pem"
PROJECT_DIR = "/caminho/no/servidor/ContabilConsult"
BRANCH = "main"

commands = [
    f"cd {PROJECT_DIR} && git fetch origin",
    f"cd {PROJECT_DIR} && git checkout {BRANCH}",
    f"cd {PROJECT_DIR} && git pull --ff-only origin {BRANCH}",
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml build web",
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml up -d web",
    f"cd {PROJECT_DIR} && docker compose -f docker-compose.prod.yml ps",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    hostname=HOST,
    port=PORT,
    username=USER,
    key_filename=KEY_PATH,
    timeout=30,
)

try:
    for command in commands:
        print(f"\\n$ {command}")
        stdin, stdout, stderr = client.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode()
        err = stderr.read().decode()
        if out:
            print(out)
        if err:
            print(err)
        if exit_code != 0:
            raise RuntimeError(f"Command failed with exit code {exit_code}: {command}")
finally:
    client.close()
```

Se o servico do frontend tiver outro nome no compose de producao, trocar `web` pelo nome correto.

---

## Deploy via SSH manual

```bash
cd /caminho/no/servidor/ContabilConsult
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web
docker compose -f docker-compose.prod.yml ps
```

Este pacote nao requer:

```bash
alembic upgrade head
```

---

## Validacao pos-deploy

### Saude tecnica

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=120 web
docker compose -f docker-compose.prod.yml logs --tail=120 api
```

Se houver endpoint de health exposto:

```bash
curl -fsS https://SEU_DOMINIO/api/v1/health
```

### Validacao funcional

1. Entrar no sistema com usuario `admin` ou `func`.
2. Abrir `Financeiro`.
3. Abrir aba `Por Empresa`.
4. Selecionar um cliente com movimentos no mes.
5. Confirmar que os KPIs aparecem no mesmo estilo da aba `Escritorio`.
6. Confirmar os cards:
   - Receita do Periodo;
   - Despesas;
   - Lucro Liquido ou Prejuizo;
   - Aplicacoes Financeiras;
   - Distribuicao de Lucros.
7. Confirmar acumulado do ano:
   - Receita do Ano;
   - Despesa do Ano;
   - Lucro ou Prejuizo do Ano;
   - Distribuicao no Ano;
   - Aplicacoes no Ano.
8. Confirmar cards auxiliares:
   - Contas a Receber;
   - Contas a Pagar;
   - Margem de Lucro Atual.
9. Clicar em cada KPI e validar que o painel de detalhe abre com lancamentos coerentes.
10. No lancamento rapido do cliente:
    - criar uma Entrada paga;
    - criar uma Saida pendente;
    - criar uma Aplicacao paga;
    - criar um Resgate pago;
    - criar uma Distribuicao de lucros paga.
11. Confirmar que:
    - aplicacao/resgate nao entram em receita/despesa operacional;
    - distribuicao de lucros nao entra em despesa operacional;
    - margem e lucro acompanham a mesma regra da aba escritorio.
12. Abrir com usuario `cliente`, quando aplicavel, e validar `Minha Empresa` com a mesma tela.

---

## Rollback

Caso a interface apresente regressao em producao:

```bash
cd /caminho/no/servidor/ContabilConsult
git log --oneline -5
git revert --no-edit <COMMIT_DESTE_DEPLOY>
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web
docker compose -f docker-compose.prod.yml ps
```

Como nao ha migration, o rollback e limitado ao frontend/documentacao.

---

## Checklist final

- [ ] Commit enviado ao remoto.
- [ ] Servidor atualizado com `git pull --ff-only`.
- [ ] Frontend reconstruido com `docker compose -f docker-compose.prod.yml build web`.
- [ ] Container `web` reiniciado.
- [ ] Aba `Por Empresa` validada com usuario do escritorio.
- [ ] Aba `Minha Empresa` validada com usuario cliente, se aplicavel.
- [ ] Aplicacao/resgate fora de receita/despesa operacional.
- [ ] Distribuicao de lucros fora de despesa operacional.
- [ ] Rollback documentado e pronto.
