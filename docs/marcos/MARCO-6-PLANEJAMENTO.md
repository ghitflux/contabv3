# Marco 6 - LICENÇAS (CNAE, Alvará, ISS) - PLANEJAMENTO COMPLETO

## 🎯 Visão Geral

O Marco 6 implementa o sistema completo de gestão de licenças, certificações e inscrições fiscais. Controla CNAEs, Alvarás, Inscrições Municipais (ISS) e outros documentos regulatórios com alertas de vencimento.

### Objetivos Principais

1. **CRUD de Licenças**: Gerenciamento completo de licenças e certificações
2. **Gestão de CNAEs**: Múltiplos CNAEs por cliente (primário + secundários)
3. **Gestão de Alvarás**: Alvará de funcionamento com controle de vencimento
4. **Inscrições Municipais (ISS)**: Gestão de inscrições municipais e estaduais
5. **Alertas de Vencimento**: Notificações automáticas de renovação
6. **Upload de Documentos**: Armazenamento de certidões e comprovantes
7. **Timeline de Eventos**: Histórico completo de cada licença
8. **Portal do Cliente**: Visão completa de suas licenças e CNAEs

---

## 📊 Métricas de Entrega

- **Blocos**: 12 blocos atômicos
- **Tempo Estimado**: 38-42 horas
- **Endpoints Backend**: ~14 novos
- **Páginas Frontend**: 3 (licenças, CNAEs, portal)
- **Tipos de Licenças**: 5+ (Alvará, ISS, CNAE, Certificados, Outros)
- **Cobertura de Testes**: Mínimo 70%
- **Integração**: Sistema de alertas + notificações

---

## 🏗️ Arquitetura

### Backend (FastAPI)

```
apps/api/app/
├── schemas/
│   ├── license.py              # Schemas Pydantic
│   ├── cnae.py                 # Schemas de CNAE
│   └── municipal_registration.py
├── db/
│   ├── models/
│   │   ├── license.py          # Model principal
│   │   ├── license_type.py     # Tipos de licenças
│   │   ├── cnae.py             # CNAEs do cliente
│   │   ├── municipal_registration.py  # ISS
│   │   └── license_event.py    # Timeline
│   └── repositories/
│       ├── license.py
│       ├── cnae.py
│       └── municipal_registration.py
├── services/
│   ├── license/
│   │   ├── manager.py          # Gestão de licenças
│   │   ├── expiration_alert.py # Alertas de vencimento
│   │   └── renewal.py          # Renovação automática
│   └── cnae/
│       └── validator.py        # Validação de CNAE
└── api/v1/routes/
    ├── licenses.py
    ├── cnaes.py
    └── municipal_registrations.py
```

### Frontend (Next.js)

```
apps/web/
├── src/
│   ├── types/
│   │   ├── license.ts
│   │   ├── cnae.ts
│   │   └── municipal_registration.ts
│   ├── lib/
│   │   └── api/endpoints/
│   │       ├── licenses.ts
│   │       ├── cnaes.ts
│   │       └── municipal_registrations.ts
│   ├── hooks/
│   │   ├── useLicenses.ts
│   │   ├── useCnaes.ts
│   │   └── useMunicipalRegistrations.ts
│   └── components/
│       └── features/
│           ├── licencas/
│           │   ├── LicensesTable.tsx
│           │   ├── LicenseCard.tsx
│           │   ├── LicenseFilters.tsx
│           │   ├── LicenseTimeline.tsx
│           │   └── ExpirationAlert.tsx
│           ├── cnaes/
│           │   ├── CnaeSelector.tsx
│           │   ├── CnaeList.tsx
│           │   └── CnaeValidator.tsx
│           └── portal/
│               └── LicensesView.tsx
└── app/
    ├── (dashboard)/
    │   └── licencas/
    │       ├── page.tsx            # Lista de licenças
    │       ├── cnaes/page.tsx      # Gestão de CNAEs
    │       └── municipais/page.tsx # Inscrições municipais
    └── (portal)/
        └── licencas/
            └── page.tsx            # Portal do cliente
```

---

## 🔄 Blocos de Desenvolvimento

### Bloco 6.1: Contracts de Licenças (Schemas + Types)

**Duração estimada**: 2 horas
**Dependências**: Marco 5 completo

**Objetivos**:
- Definir schemas Pydantic para License, CNAE, MunicipalRegistration
- Definir tipos TypeScript correspondentes
- Documentar contratos da API
- Enums para tipos de licença e status

**Entregáveis**:
```
apps/api/app/schemas/
✓ license.py (LicenseCreate, LicenseUpdate, LicenseResponse)
✓ cnae.py (CnaeCreate, CnaeResponse)
✓ municipal_registration.py (MunicipalRegistrationCreate, etc)

apps/web/src/types/
✓ license.ts (interfaces correspondentes)
✓ cnae.ts
✓ municipal_registration.ts

docs/
✓ contracts/license-api.md
```

**Critérios de aceite**:
- Schemas Pydantic validam corretamente
- Tipos TypeScript sincronizados
- Documentação clara de endpoints
- Enums definidos (LicenseType, LicenseStatus)

**Prompt sugerido**:
```
Defina contratos completos para módulo de licenças:

Backend (Pydantic v2):
- LicenseCreate, LicenseUpdate, LicenseResponse
- CnaeCreate, CnaeUpdate, CnaeResponse
- MunicipalRegistrationCreate, MunicipalRegistrationUpdate, MunicipalRegistrationResponse
- LicenseEventCreate, LicenseEventResponse

Enums:
- LicenseType: alvara_funcionamento, inscricao_municipal, inscricao_estadual, certificado_digital, outros
- LicenseStatus: ativa, vencida, pendente_renovacao, cancelada, em_processo
- CnaeType: principal, secundario

Campos principais de License:
- client_id (FK)
- license_type (enum)
- status (enum)
- issue_date, expiration_date
- issuing_authority (órgão emissor)
- registration_number (número da licença/inscrição)
- notes
- document_url (attachment)

Campos principais de CNAE:
- client_id (FK)
- cnae_code (string, format: "0000-0/00")
- cnae_type (principal/secundario)
- description
- is_active

Campos de MunicipalRegistration:
- client_id (FK)
- city, state
- registration_number (inscrição municipal)
- status
- issue_date

Frontend (TypeScript):
- Interfaces correspondentes
- Enums sincronizados

Documente endpoints:
- GET/POST /licenses
- GET/PUT/DELETE /licenses/:id
- GET /licenses/:id/events
- POST /licenses/:id/renew
- GET /cnaes (por cliente)
- POST/DELETE /cnaes
- GET/POST /municipal-registrations
```

---

### Bloco 6.2: Models e Migrations

**Duração estimada**: 3-4 horas
**Dependências**: Bloco 6.1

**Objetivos**:
- Models SQLAlchemy para License, CNAE, MunicipalRegistration, LicenseEvent
- Migrations Alembic
- Relacionamentos com Client
- Índices apropriados

**Entregáveis**:
```
apps/api/app/db/models/
✓ license.py
✓ license_type.py (se necessário)
✓ cnae.py
✓ municipal_registration.py
✓ license_event.py

apps/api/alembic/versions/
✓ 20251030_xxxx_create_licenses_tables.py

apps/api/tests/unit/models/
✓ test_license.py
✓ test_cnae.py
```

**Critérios de aceite**:
- Migration cria 4 tabelas + enums PostgreSQL
- Relacionamentos funcionam (client.licenses)
- Índices: client_id, status, expiration_date, cnae_code
- Constraint: apenas 1 CNAE principal por cliente
- Testes unitários passam

**Prompt sugerido**:
```
Crie models SQLAlchemy 2 async para licenças:

1. License:
   - id (UUID)
   - client_id (FK -> clients.id)
   - license_type (enum)
   - status (enum)
   - issue_date, expiration_date (Date)
   - issuing_authority (String)
   - registration_number (String)
   - notes (Text, nullable)
   - document_id (FK -> attachments.id, nullable)
   - created_at, updated_at
   - Relacionamento: client, events, document

2. CNAE:
   - id (UUID)
   - client_id (FK)
   - cnae_code (String, format validated)
   - cnae_type (principal/secundario)
   - description (String)
   - is_active (Boolean)
   - created_at
   - Constraint: UNIQUE(client_id, cnae_code)
   - Constraint: Máximo 1 CNAE principal por cliente

3. MunicipalRegistration:
   - id (UUID)
   - client_id (FK)
   - city, state (String)
   - registration_number (String, unique)
   - status (enum)
   - issue_date (Date)
   - notes (Text)
   - created_at, updated_at

4. LicenseEvent:
   - id (UUID)
   - license_id (FK)
   - event_type (created, renewed, expired, cancelled, updated)
   - description (Text)
   - user_id (FK, nullable)
   - created_at

Crie migration e testes unitários.
```

---

### Bloco 6.3: Repositories

**Duração estimada**: 3 horas
**Dependências**: Bloco 6.2

**Objetivos**:
- LicenseRepository com métodos CRUD e queries específicas
- CnaeRepository
- MunicipalRegistrationRepository
- Queries otimizadas

**Entregáveis**:
```
apps/api/app/db/repositories/
✓ license.py (LicenseRepository)
✓ cnae.py (CnaeRepository)
✓ municipal_registration.py (MunicipalRegistrationRepository)

apps/api/tests/unit/repositories/
✓ test_license_repository.py
```

**Critérios de aceite**:
- CRUD completo
- Métodos específicos: get_expiring_soon(days=30), get_by_client, get_active
- Paginação e filtros
- Testes passam

**Prompt sugerido**:
```
Implemente repositories:

1. LicenseRepository:
   - list_with_filters(client_id, license_type, status, page, size)
   - get_by_id, get_by_client
   - get_expiring_soon(days: int = 30) -> List[License]
   - get_expired() -> List[License]
   - create, update, delete
   - add_event(license_id, event_type, description, user_id)

2. CnaeRepository:
   - get_by_client(client_id) -> List[Cnae]
   - get_primary(client_id) -> Optional[Cnae]
   - set_as_primary(cnae_id) -> None (remove primary de outros)
   - validate_cnae_format(code: str) -> bool
   - create, delete

3. MunicipalRegistrationRepository:
   - get_by_client(client_id)
   - get_by_city_state(city, state)
   - create, update, delete

Inclua testes unitários para métodos principais.
```

---

### Bloco 6.4: Services (LicenseService + ExpirationAlert)

**Duração estimada**: 4 horas
**Dependências**: Bloco 6.3

**Objetivos**:
- LicenseService com regras de negócio
- ExpirationAlertService para notificações
- Validações (CNAE, datas, etc)
- Integração com NotificationService

**Entregáveis**:
```
apps/api/app/services/license/
✓ manager.py (LicenseService)
✓ expiration_alert.py (ExpirationAlertService)
✓ renewal.py (RenewalService)

apps/api/app/services/cnae/
✓ validator.py (CnaeValidator)

apps/api/tests/unit/services/
✓ test_license_service.py
✓ test_expiration_alert.py
```

**Critérios de aceite**:
- Validação de CNAE (formato "0000-0/00")
- Apenas 1 CNAE principal por cliente
- Alertas automáticos de vencimento (30, 15, 7, 1 dia antes)
- Renovação marca antiga como expirada e cria nova
- Testes cobrem casos principais

**Prompt sugerido**:
```
Implemente serviços de licenças:

1. LicenseService (manager.py):
   - create_license(data, user_id) -> License
   - update_license(license_id, data, user_id) -> License
   - renew_license(license_id, new_expiration, user_id) -> License
     * Marca antiga como expirada
     * Cria nova com mesmos dados
     * Registra evento
   - delete_license(license_id, user_id)
   - check_expirations() -> None (chama ExpirationAlertService)

2. ExpirationAlertService:
   - check_and_notify() -> None
     * Busca licenças expirando em 30, 15, 7, 1 dia(s)
     * Cria notificação para funcionários responsáveis
     * Marca como alerta enviado (evita duplicatas)
   - get_expiring_licenses(days: int) -> List[License]

3. CnaeValidator:
   - validate_format(cnae_code: str) -> bool
   - validate_primary_constraint(client_id) -> None
     * Garante apenas 1 CNAE principal

Integre com NotificationService existente.
Inclua testes unitários.
```

---

### Bloco 6.5: API Routes - CRUD de Licenças

**Duração estimada**: 3 horas
**Dependências**: Bloco 6.4

**Objetivos**:
- Rotas RESTful para licenças
- Rotas para CNAEs
- Rotas para inscrições municipais
- Documentação OpenAPI

**Entregáveis**:
```
apps/api/app/api/v1/routes/
✓ licenses.py
✓ cnaes.py
✓ municipal_registrations.py

apps/api/tests/integration/
✓ test_licenses_routes.py
✓ test_cnaes_routes.py
```

**Critérios de aceite**:
- 14 endpoints funcionando
- RBAC implementado (admin/func acesso total, cliente read-only)
- Validações corretas
- Testes de integração passam

**Endpoints**:
```
Licenses:
- GET /licenses (list com filtros)
- POST /licenses (admin/func only)
- GET /licenses/:id
- PUT /licenses/:id (admin/func only)
- DELETE /licenses/:id (admin only)
- POST /licenses/:id/renew (admin/func only)
- GET /licenses/:id/events (timeline)

CNAEs:
- GET /cnaes (por client_id query param)
- POST /cnaes (admin/func only)
- PUT /cnaes/:id/set-primary (admin/func only)
- DELETE /cnaes/:id (admin/func only)

Municipal Registrations:
- GET /municipal-registrations (por client_id)
- POST /municipal-registrations (admin/func only)
- PUT /municipal-registrations/:id (admin/func only)
```

**Prompt sugerido**:
```
Implemente rotas RESTful de licenças:

1. licenses.py:
   - GET /licenses (filtros: client_id, license_type, status, page, size)
   - POST /licenses (admin/func only)
   - GET /licenses/:id
   - PUT /licenses/:id (admin/func only)
   - DELETE /licenses/:id (admin only, soft delete)
   - POST /licenses/:id/renew (admin/func only)
   - GET /licenses/:id/events (timeline)

2. cnaes.py:
   - GET /cnaes?client_id=xxx
   - POST /cnaes (valida formato)
   - PUT /cnaes/:id/set-primary (remove primary de outros)
   - DELETE /cnaes/:id

3. municipal_registrations.py:
   - GET /municipal-registrations?client_id=xxx
   - POST /municipal-registrations
   - PUT /municipal-registrations/:id

Adicione documentação OpenAPI em cada rota.
Inclua testes de integração com TestClient.
```

---

### Bloco 6.6: Sistema de Alertas Automáticos

**Duração estimada**: 3 horas
**Dependências**: Bloco 6.5

**Objetivos**:
- Background task para checagem de vencimentos
- Integração com sistema de notificações
- Configuração de intervalos de alerta
- Dashboard de alertas

**Entregáveis**:
```
apps/api/app/tasks/
✓ license_expiration.py (background task)

apps/api/app/api/v1/routes/
✓ Update licenses.py com endpoint de alertas

apps/api/tests/integration/
✓ test_license_alerts.py
```

**Critérios de aceite**:
- Task roda diariamente (configurável)
- Alertas em 30, 15, 7, 1 dia antes
- Notificações criadas corretamente
- Não duplica alertas
- Endpoint para forçar checagem manual

**Prompt sugerido**:
```
Implemente sistema de alertas de vencimento:

1. Background Task (license_expiration.py):
   - Função check_license_expirations()
   - Roda diariamente às 8h (APScheduler ou similar)
   - Chama ExpirationAlertService.check_and_notify()
   - Log de execução

2. Endpoint manual:
   - POST /licenses/check-expirations (admin only)
   - Retorna quantos alertas foram criados

3. Lógica de alertas:
   - Verificar dias até vencimento
   - Criar notificação se em [30, 15, 7, 1] dias
   - Marcar alerta enviado (evitar duplicatas)
   - Tipo de notificação: "license_expiring"

Use APScheduler ou similar para agendamento.
Inclua testes.
```

---

### Bloco 6.7: Dashboard Frontend - Gestão de Licenças

**Duração estimada**: 5 horas
**Dependências**: Bloco 6.5

**Objetivos**:
- Página principal de licenças
- Tabela com filtros
- Cards de resumo (ativas, expirando, vencidas)
- Modal de detalhes
- Form de criação/edição

**Entregáveis**:
```
apps/web/app/(dashboard)/licencas/
✓ page.tsx

apps/web/src/components/features/licencas/
✓ LicensesTable.tsx
✓ LicenseCard.tsx
✓ LicenseFilters.tsx
✓ LicenseModal.tsx
✓ LicenseForm.tsx
✓ ExpirationBadge.tsx

apps/web/src/hooks/
✓ useLicenses.ts
```

**Critérios de aceite**:
- Dashboard mostra cards de resumo
- Tabela com paginação server-side
- Filtros por tipo, status, cliente
- Modal de detalhes com timeline
- Form de criação/edição funcional
- Badge visual de vencimento (verde/amarelo/vermelho)

**Prompt sugerido**:
```
Crie dashboard de licenças no frontend:

1. Página /licencas (page.tsx):
   - Cards de resumo no topo:
     * Total ativas
     * Expirando (próximos 30 dias)
     * Vencidas
   - Tabela de licenças abaixo
   - Botão "Nova Licença"

2. LicensesTable:
   - Colunas: Cliente, Tipo, Número, Órgão Emissor, Emissão, Vencimento, Status, Ações
   - Badge de status colorido
   - ExpirationBadge (vermelho se vencida, amarelo se < 30 dias, verde se ok)
   - Click abre modal de detalhes

3. LicenseFilters:
   - Busca por cliente/número
   - Filtro por tipo
   - Filtro por status
   - Filtro "Expirando em 30 dias"

4. LicenseModal:
   - Detalhes completos
   - Timeline de eventos
   - Botão "Renovar" (se ativa)
   - Botão "Editar"

5. LicenseForm:
   - Select de cliente
   - Select de tipo
   - Inputs de número, órgão emissor
   - Date pickers de emissão/vencimento
   - Upload de documento (opcional)
   - Validação Zod

Use HeroUI para todos componentes.
```

---

### Bloco 6.8: Interface de CNAEs

**Duração estimada**: 3 horas
**Dependências**: Bloco 6.7

**Objetivos**:
- Subpágina de CNAEs
- Lista de CNAEs por cliente
- Marcação de CNAE principal
- Validação de formato

**Entregáveis**:
```
apps/web/app/(dashboard)/licencas/cnaes/
✓ page.tsx

apps/web/src/components/features/cnaes/
✓ CnaeList.tsx
✓ CnaeForm.tsx
✓ CnaeValidator.tsx

apps/web/src/hooks/
✓ useCnaes.ts
```

**Critérios de aceite**:
- Lista CNAEs do cliente selecionado
- Indica visualmente CNAE principal
- Botão para marcar como principal
- Form com validação de formato (0000-0/00)
- Busca de descrição de CNAE (API externa ou tabela local)

**Prompt sugerido**:
```
Crie interface de gestão de CNAEs:

1. Página /licencas/cnaes:
   - Select de cliente (admin/func)
   - Lista de CNAEs do cliente
   - Botão "Adicionar CNAE"

2. CnaeList:
   - Card para cada CNAE
   - Badge "Principal" no CNAE principal
   - Botão "Marcar como principal" (se não for)
   - Botão "Remover"
   - Código + Descrição

3. CnaeForm:
   - Input de código com máscara (0000-0/00)
   - Validação formato
   - Input descrição (opcional, pode buscar de API)
   - Radio: Principal / Secundário
   - Submit

4. CnaeValidator:
   - Valida formato em tempo real
   - Mostra erro se inválido
   - (Opcional) Busca descrição de CNAE via API externa

Use HeroUI.
```

---

### Bloco 6.9: Interface de Inscrições Municipais

**Duração estimada**: 3 horas
**Dependências**: Bloco 6.8

**Objetivos**:
- Subpágina de inscrições municipais
- CRUD simples
- Associação por cliente

**Entregáveis**:
```
apps/web/app/(dashboard)/licencas/municipais/
✓ page.tsx

apps/web/src/components/features/municipal/
✓ MunicipalRegistrationsList.tsx
✓ MunicipalRegistrationForm.tsx

apps/web/src/hooks/
✓ useMunicipalRegistrations.ts
```

**Critérios de aceite**:
- Tabela de inscrições municipais
- Form de criação/edição
- Filtro por cliente
- Campo de cidade/estado

**Prompt sugerido**:
```
Crie interface de inscrições municipais:

1. Página /licencas/municipais:
   - Tabela de inscrições
   - Filtro por cliente
   - Botão "Nova Inscrição"

2. MunicipalRegistrationsList:
   - Colunas: Cliente, Cidade, Estado, Número Inscrição, Data Emissão, Status
   - Click abre modal de edição

3. MunicipalRegistrationForm:
   - Select cliente
   - Input cidade
   - Select estado (UF)
   - Input número inscrição
   - Date picker emissão
   - Select status
   - Textarea notas

Use HeroUI.
```

---

### Bloco 6.10: Portal do Cliente - Licenças

**Duração estimada**: 3 horas
**Dependências**: Bloco 6.9

**Objetivos**:
- Visão de licenças no portal do cliente
- Read-only
- Destaque para vencimentos próximos

**Entregáveis**:
```
apps/web/app/(portal)/licencas/
✓ page.tsx

apps/web/src/components/features/portal/
✓ LicensesView.tsx
✓ CnaeView.tsx
```

**Critérios de aceite**:
- Cliente vê apenas suas licenças
- Alertas visuais de vencimento
- Download de documentos anexados
- Visualização de CNAEs
- Sem botões de edição

**Prompt sugerido**:
```
Crie visão de licenças no portal do cliente:

1. Página /portal/licencas:
   - Alert se há licenças vencendo em breve
   - Cards de licenças ativas
   - Seção de CNAEs
   - Seção de inscrições municipais

2. LicensesView (portal):
   - Lista de licenças do cliente logado
   - Badge de vencimento
   - Link para download de documento
   - Read-only (sem botões de ação)

3. CnaeView:
   - Lista de CNAEs
   - Destaque no principal
   - Read-only

Use HeroUI.
Cliente só vê próprias licenças (verificar role no backend).
```

---

### Bloco 6.11: Seed de Dados e Testes

**Duração estimada**: 2 horas
**Dependências**: Bloco 6.10

**Objetivos**:
- Script de seed com licenças de exemplo
- Testes de integração completos
- Validação end-to-end

**Entregáveis**:
```
apps/api/scripts/
✓ seed_licenses.py

apps/api/tests/
✓ integration/test_licenses_flow.py
✓ e2e/test_license_lifecycle.py
```

**Critérios de aceite**:
- Seed cria 10-15 licenças de exemplo
- Mix de tipos (alvará, ISS, certificado)
- Mix de status (ativas, vencendo, vencidas)
- Testes end-to-end passam

**Prompt sugerido**:
```
Crie seed de licenças e testes:

1. seed_licenses.py:
   - Cria 15 licenças de exemplo
   - Mix de tipos: alvará (5), ISS (5), certificado digital (3), outros (2)
   - Mix de status: ativas (8), vencendo (4), vencidas (3)
   - CNAEs para cada cliente (1 principal + 2 secundários)
   - Inscrições municipais (5 clientes)

2. Testes de integração:
   - Fluxo completo: criar -> listar -> atualizar -> renovar
   - Teste de alertas de vencimento
   - Teste de constraint CNAE principal (apenas 1)

3. Testes E2E (opcional):
   - Simula ações de admin
   - Simula visualização de cliente

Execute seed e testes.
```

---

### Bloco 6.12: Integração Final e Documentação

**Duração estimada**: 2 horas
**Dependências**: Bloco 6.11

**Objetivos**:
- Validação completa
- Atualização de documentação
- Checklist de entrega

**Entregáveis**:
```
docs/
✓ MARCO-6-RESUMO.md

✓ Lint e type-check passando
✓ Build frontend OK
✓ Todos testes passando
```

**Critérios de aceite**:
- `pnpm lint` OK
- `pnpm type-check` OK
- `pnpm test` OK (backend)
- `pnpm build` OK (frontend)
- Documentação atualizada

**Prompt sugerido**:
```
Finalize Marco 6:

1. Execute validações:
   - pnpm lint
   - pnpm type-check
   - pytest apps/api/tests/
   - pnpm build

2. Crie MARCO-6-RESUMO.md:
   - Funcionalidades entregues
   - Endpoints criados (listar todos)
   - Páginas frontend
   - Estatísticas (arquivos, linhas, componentes)
   - Screenshots (se possível)
   - Próximos passos

3. Atualize progress.json:
   - Marco 6 completo
   - Preparar para Marco 7

4. Git commit:
   - feat(licenses): implement complete license management system (Marco 6)
```

---

## 📋 Checklist de Conclusão

- [ ] Bloco 6.1: Contracts ✓
- [ ] Bloco 6.2: Models e Migrations ✓
- [ ] Bloco 6.3: Repositories ✓
- [ ] Bloco 6.4: Services ✓
- [ ] Bloco 6.5: API Routes CRUD ✓
- [ ] Bloco 6.6: Sistema de Alertas ✓
- [ ] Bloco 6.7: Dashboard Frontend ✓
- [ ] Bloco 6.8: Interface CNAEs ✓
- [ ] Bloco 6.9: Interface Inscrições Municipais ✓
- [ ] Bloco 6.10: Portal do Cliente ✓
- [ ] Bloco 6.11: Seed e Testes ✓
- [ ] Bloco 6.12: Integração Final ✓

---

## 🎯 Métricas de Sucesso

- **Endpoints**: 14 endpoints RESTful funcionando
- **Páginas**: 4 páginas frontend (licenças, CNAEs, municipais, portal)
- **Componentes**: 12+ componentes React
- **Testes**: Mínimo 70% cobertura
- **Alertas**: Sistema automático de vencimento funcionando
- **CNAE**: Validação e constraint de principal
- **Portal**: Cliente acessa suas licenças

---

## 🚀 Próximos Passos (Marco 7)

Após completar Marco 6:
- **Marco 7**: Relatórios e Analytics (dashboards, exports, KPIs)
