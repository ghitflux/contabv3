# Atualizações (2026-01-27)

Este documento registra as alterações implementadas no **cadastro/detalhes de clientes**, **obrigações**, **licenças**, **honorários recorrentes**, **datas antigas**, e a **correção do erro que impedia criação de bancos no Financeiro** em produção.

## 1) Cadastro de Cliente (ClientFormModal)

Arquivo: `apps/web/src/components/features/clientes/ClientFormModal.tsx`

- Campo **“Senha NFS-e”** renomeado para **“Senha NFS-e Nacional”** (somente label; backend continua usando `senha_nfse`).
- **Obrigações**:
  - Exibição **sem filtro** (todas ficam visíveis para seleção).
  - Inclusão de **DAS-MEI** e **DASN SIMEI** (vem do backend via `/obligations/types`).
  - Seleção agora salva como `obligation_types_ids` no cliente (IDs de `ObligationType`).
- **Licenças Necessárias (multi)**:
  - Adicionada opção **“Alvará de Funcionamento”**.
- **Datas**:
  - “Data de Abertura” e “Início no Escritório” permitem datas antigas desde **ano 1800**.
  - Ambos os campos permitem **digitação manual** (além do calendário).
- **Honorários**:
  - Adicionado select **“Lançar honorários automaticamente?”** (`gerar_lancamentos_honorarios`).
  - Quando “Sim”, o backend cria lançamentos recorrentes (cliente: **despesa**; escritório: **receita**).

## 2) Detalhes do Cliente (ClientDetailsModal)

Arquivo: `apps/web/src/components/features/clientes/ClientDetailsModal.tsx`

Na primeira seção “Dados da Empresa”, adicionados:
- **CPF**
- **Senha GOV**
- **Senha da Prefeitura**
- **Código de Acesso ao Simples Nacional**

## 3) DatePicker com digitação manual e ano mínimo

Arquivo: `apps/web/src/components/ui/DatePickerField.tsx`

- Campo agora aceita digitação em **DD/MM/AAAA**, **DD-MM-AAAA**, **AAAA-MM-DD**.
- Suporta `minYear` (usado em clientes com `minYear={1800}`).

## 4) Obrigações (backend): novos tipos + dedupe + override por cliente

Arquivos:
- `apps/api/app/api/v1/routes/obligations.py`
- `apps/api/app/services/obligation/seed_types.py`
- `apps/api/app/patterns/factories/obligation_factory.py`

Mudanças:
- Seed de `ObligationType` inclui **DAS-MEI** e **DASN SIMEI**.
- **Correção de duplicidades** (ex.: ECD/EFD Reinf) por **nome**:
  - Mantém o tipo canônico (preferindo o “code” padrão quando existe).
  - Marca duplicados como `is_active=false`.
  - Migra referências em `obligations.obligation_type_id` e `clients.obligation_types_ids`.
- Geração de obrigações respeita `client.obligation_types_ids` quando informado (override manual).

## 5) Licenças Necessárias (backend): mapeamento para cards de licença

Arquivo: `apps/api/app/services/client.py`

- Ao cadastrar cliente, `licencas_necessarias` cria cards de licença automáticos (status **EM_PROCESSO**) usando mapeamento.
- Inclui `alvara_funcionamento` para gerar o tipo `ALVARA_FUNCIONAMENTO`.

## 6) Honorários automáticos (backend) + Escritório único (ID fixo)

Arquivos:
- `apps/api/app/db/models/client.py`
- `apps/api/app/schemas/client.py`
- `apps/api/app/services/client.py`
- `apps/api/app/core/config.py`

Mudanças:
- Novo campo `clients.gerar_lancamentos_honorarios` (boolean).
- Se `gerar_lancamentos_honorarios=true` e `honorarios_mensais > 0`, cria:
  - **Cliente**: lançamento **DESPESA** em contas a pagar (competência do próximo vencimento).
  - **Escritório**: lançamento **RECEITA** no financeiro do escritório (mesma competência), usando `OFFICE_CLIENT_ID`.
- `OFFICE_CLIENT_ID` tem default (caso não configure env): `522d5b00-2a4d-4f5a-8913-5d4ee0cf8104`.

### Migrations

- `apps/api/alembic/versions/20260127_1200_add_client_honorarios_auto_flag.py`
  - Adiciona coluna `gerar_lancamentos_honorarios` em `clients`.
- `apps/api/alembic/versions/20260127_1210_seed_office_client.py`
  - Cria um “cliente do escritório” com **ID fixo** (`522d5b00-2a4d-4f5a-8913-5d4ee0cf8104`) para suportar lançamentos/relacionamentos do financeiro e licenças do escritório.

## 7) Correção do erro (React #418) no módulo Financeiro (produção)

Arquivos (principais):
- `apps/web/src/components/features/financeiro/FinanceiroEscritorio.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroPorEmpresa.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroLancamentos.tsx`
- `apps/web/src/components/features/financeiro/FinanceiroModule.tsx`
- `apps/web/src/components/features/financeiro/NovoLancamentoModal.tsx`
- `apps/web/src/components/features/relatorios/RelatoriosModule.tsx`
- `apps/web/src/components/features/atividades/AtividadesCalendar.tsx`

Correção aplicada:
- Removidos valores **não determinísticos** (ex.: `new Date()`) de inicializações que rodam no SSR/hidratação.
- Datas “default” passam a ser definidas em `useEffect` (client-only), evitando **Hydration mismatch** em produção.

## 8) Deploy: variáveis `NEXT_PUBLIC_*` em build time (Next.js)

Arquivos:
- `infra/docker/Dockerfile.web.prod`
- `docker-compose.prod.yml`
- `.env.prod.example`

Pontos importantes:
- `NEXT_PUBLIC_*` em Next.js é “inlined” no **build** (não basta estar no runtime).
- `docker-compose.prod.yml` foi ajustado para passar `build.args` (inclui `NEXT_PUBLIC_OFFICE_CLIENT_ID`).
- Exemplo atualizado em `.env.prod.example`.
- **Next.js (web)** requer **Node >= 20.9.0** para build; o `Dockerfile.web.prod` já usa Node 20.

## Checklist de validação pós-deploy

1. Subir `api` com `alembic upgrade head` (já está no `command` do compose).
2. Subir `web` garantindo `NEXT_PUBLIC_OFFICE_CLIENT_ID` no build.
3. Criar/editar cliente:
   - “Senha NFS-e Nacional” aparece.
   - Obrigações listam todas (inclui DAS-MEI/DASN SIMEI) e sem duplicidades.
   - Datas aceitam ano 1800 e digitação manual.
   - “Alvará de Funcionamento” aparece em licenças necessárias.
   - Se “Lançar honorários automaticamente?” = Sim, verificar lançamentos no financeiro do cliente (despesa) e escritório (receita).
4. No Financeiro (escritório e cliente), criar banco e confirmar que o erro React #418 não ocorre.
