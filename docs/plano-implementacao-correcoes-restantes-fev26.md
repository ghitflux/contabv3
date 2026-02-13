# Plano de Implementação - Correções Restantes (Fev/2026)

Data: 08/02/2026

## Objetivo

Implementar todas as correções pendentes do checklist `docs/correcoes-fev26.md` (exceto Cliente e Financeiro já validados), com foco em estabilidade funcional, consistência visual, recuperação de dados e uso mobile.

## Escopo restante

Módulos pendentes:
1. Obrigações
2. Licenças
3. Relatórios
4. Downloads
5. Atividade
6. Configuração

Itens transversais:
1. Lixeira em todos os painéis restantes
2. Responsividade mobile do sistema inteiro

Pendência residual (fora do checklist original):
1. Módulo Financeiro: filtro de data na interface não está funcionando corretamente e deve ser corrigido em paralelo à fase de hardening.

## Priorização

P0 (crítico para operação):
1. Atividade
2. Obrigações
3. Relatórios

P1 (produtividade e UX):
1. Licenças
2. Downloads
3. Configuração

P2 (qualidade transversal):
1. Lixeira global
2. Ajustes mobile fim a fim

## Roadmap

Fase 1 (5 a 7 dias úteis):
1. Obrigações (correção de exibição de empresas/obrigações)
2. Atividade (núcleo recorrente + vínculo com obrigações)
3. Relatórios (fluxo mínimo funcional de preview/export/download)

Fase 2 (4 a 6 dias úteis):
1. Licenças (filtro e layout padrão)
2. Downloads (exclusão de itens)
3. Relatórios (exclusão de relatórios solicitados)
4. Configuração (ativar/excluir usuários inativos)

Fase 3 (4 a 6 dias úteis):
1. Lixeira nos módulos faltantes
2. Responsividade mobile (desktop/mobile parity)

Fase 4 (2 a 3 dias úteis):
1. Regressão completa
2. Homologação
3. Hardening final

## Plano por módulo

## 1) Obrigações

Problema do checklist:
- A página apresenta erros de exibição (empresas e obrigações).

Back-end:
1. Revisar queries de listagem e joins `obligations` x `clients`.
2. Garantir filtros por competência/status sem perda de relacionamento.
3. Validar paginação e ordenação estáveis.

Front-end:
1. Revisar fluxo de carregamento da matriz de obrigações.
2. Corrigir renderização para clientes sem obrigação no período.
3. Melhorar handling de erro e estado vazio.

Testes:
1. Integração API por cliente/mês/status.
2. E2E de troca de competência e render completo.

Critério de aceite:
1. Empresas e obrigações visíveis de forma consistente em todas as competências.
2. Sem erro de runtime no console ao navegar/filtar.

## 2) Licenças

Problemas do checklist:
- Filtro de busca não funciona.
- Layout deve seguir padrão da tela inicial (empresa + licenças em colunas).

Back-end:
1. Garantir endpoint com busca por razão social, fantasia, CNPJ, tipo e status.

Front-end:
1. Corrigir pipeline do filtro (estado + query + debounce).
2. Refatorar tabela para layout matricial:
- coluna de empresa
- colunas de licenças
- status abaixo de cada licença

Testes:
1. Busca por nome/CNPJ/status.
2. Teste visual desktop e mobile do novo layout.

Critério de aceite:
1. Filtro retorna dados corretos em cenário nominal.
2. Layout padronizado conforme checklist.

## 3) Relatórios

Problemas do checklist:
- Nenhum relatório está funcionando.
- Em Download, precisa existir exclusão dos relatórios solicitados.

Back-end:
1. Recuperar serviços de geração por tipo (`dre`, `fluxo_caixa`, `livro_caixa`, etc.).
2. Validar exportadores CSV/PDF.
3. Implementar exclusão lógica no histórico de relatórios.
4. Tratar limpeza de arquivo físico órfão.

Front-end:
1. Corrigir fluxo completo de preview/export/download.
2. Adicionar ação de exclusão na lista de relatórios solicitados.
3. Exibir estado de expiração/arquivo indisponível quando aplicável.

Testes:
1. Integração de export por tipo.
2. E2E: solicitar, baixar e excluir relatório.

Critério de aceite:
1. Todos os tipos listados em `/reports/types` exportam sem erro.
2. Exclusão de relatório aparece imediatamente na UI.

## 4) Downloads

Problema do checklist:
- Incluir opção de exclusão.

Back-end:
1. Endpoint de exclusão lógica de item baixável.
2. Política de autorização por usuário.

Front-end:
1. Botão de excluir com confirmação.
2. Atualização imediata da listagem após exclusão.

Testes:
1. Exclusão autorizada vs não autorizada.
2. Persistência de estado após reload.

Critério de aceite:
1. Item pode ser excluído com rastreabilidade.

## 5) Atividade

Problemas do checklist:
- Painel crítico para prazos.
- Atividade recorrente com alerta contínuo a 5 dias.
- Vínculo direto com Obrigações.
- Vínculo com empresas obrigadas e status automático (não concluída/pendente).
- Cadastro deve ter data início, fim e empresas vinculadas.

Modelo de dados:
1. Adicionar campos: `start_date`, `end_date`, `is_recurring`, `recurrence_rule`, `linked_client_ids`.
2. Adicionar vínculo com tipo/instância de obrigação quando aplicável.

Back-end:
1. Gerar ocorrências recorrentes por período.
2. Job diário para alertas D-5 e vencidas.
3. Implementar regra de status automática baseada em baixa da obrigação.

Front-end:
1. Atualizar formulário com datas e empresas vinculadas.
2. Integrar Atividade com Obrigações (atalho e filtro cruzado).
3. Exibir alerta contínuo na tela inicial.

Testes:
1. Unidade para recorrência e transição de status.
2. Integração para vínculo atividade-obrigação-empresa.
3. E2E de alerta contínuo.

Critério de aceite:
1. Atividades recorrentes geram corretamente.
2. Status muda automaticamente conforme regra do checklist.
3. Alerta permanece até baixa.

## 6) Configuração

Problema do checklist:
- Usuários inativos precisam ter opções de ativar e excluir.

Back-end:
1. Endpoint de ativação de usuário inativo.
2. Endpoint de exclusão lógica de usuário.
3. Audit log obrigatório nas duas ações.

Front-end:
1. Ações “Ativar” e “Excluir” em usuários inativos.
2. Confirmação explícita para exclusão.

Testes:
1. Fluxo permitido para perfil autorizado.
2. Bloqueio de permissão para perfis não autorizados.

Critério de aceite:
1. Ativação e exclusão funcionando ponta a ponta com rastreabilidade.

## Plano transversal

## Lixeira global

Entrega:
1. Adotar padrão único de soft-delete/restore em todos os módulos faltantes.
2. Componentizar modal/lista de lixeira reutilizável.
3. Garantir endpoints de listagem `deleted_only` e restauração por entidade.

Critério de aceite:
1. Todos os painéis com exclusão têm recuperação via lixeira.

## Mobile

Entrega:
1. Auditoria de breakpoints nas telas principais.
2. Ajuste de tabelas (compactação/colunas colapsáveis/scroll seguro).
3. Ajuste de modais para full width em telas pequenas.
4. Revisão de área de toque em botões primários.

Critério de aceite:
1. Navegação completa em mobile sem quebra horizontal e sem perda de ação crítica.

## Estratégia de QA

1. Smoke API por módulo.
2. E2E para fluxos críticos.
3. Regressão visual desktop/mobile.
4. Checklist de aceite final espelhando item a item o `docs/correcoes-fev26.md`.

## Riscos e mitigação

Risco: dependência entre Atividade e Obrigações.
Mitigação: fechar contrato de API do vínculo antes da implementação final de UI.

Risco: inconsistência de soft-delete entre módulos.
Mitigação: padronizar contrato técnico de lixeira antes da implementação em lote.

Risco: regressão desktop durante ajustes mobile.
Mitigação: regressão visual paralela desktop/mobile por fase.

## Entregáveis

1. PRs por fase (P0, P1, P2, hardening).
2. Evidências de teste automatizado e funcional.
3. Documento de aceite preenchido por item do checklist.
4. Changelog final de correções.
