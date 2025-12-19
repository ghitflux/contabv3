Vou analisar profundamente seu PRD e propor melhorias estruturais e organizacionais que vão tornar o desenvolvimento com Claude Code muito mais eficiente. Vou manter toda a essência do seu documento, mas adicionar camadas de organização, padrões e divisão estratégica.

# PRD Otimizado — SaaS Contábil

## Melhorias Implementadas na Estrutura

Primeiro, deixe-me explicar as otimizações que vou propor:

### 1. Arquitetura em Camadas Explícitas

Seu documento já tem boa separação, mas vou formalizar as camadas para que cada bloco de desenvolvimento no Claude Code tenha fronteiras claras. Isso evita que mudanças em uma área afetem outras desnecessariamente.

### 2. Contracts-First Approach

Vou propor que cada marco comece definindo contratos (tipos TypeScript e schemas Pydantic) ANTES de implementar lógica. Isso permite desenvolvimento paralelo e testes mais robustos.

### 3. Dependency Injection Container

No backend FastAPI, vou sugerir um container DI explícito para facilitar testes e manutenção dos serviços.

### 4. Feature Flags desde o início

Adicionar suporte a feature flags desde o Marco 1 permite desenvolver funcionalidades sem afetar produção.

### 5. Testes Estruturados por Camada

Cada marco terá objetivos de cobertura de testes específicos.

---

## Estrutura de Projeto Otimizada

```
/ (monorepo-saas-contabil)
├── apps/
│   ├── web/                          # Next.js 16 App
│   │   ├── app/
│   │   │   ├── (auth)/              # Grupo de rotas autenticadas
│   │   │   │   ├── login/
│   │   │   │   ├── reset-password/
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/         # Grupo de rotas internas
│   │   │   │   ├── clientes/
│   │   │   │   ├── obrigacoes/
│   │   │   │   ├── financeiro/
│   │   │   │   ├── licencas/
│   │   │   │   ├── relatorios/
│   │   │   │   ├── atividades/
│   │   │   │   └── layout.tsx       # Layout com sidebar/header
│   │   │   ├── (portal)/            # Grupo portal do cliente
│   │   │   │   ├── meus-dados/
│   │   │   │   ├── obrigacoes/
│   │   │   │   ├── financeiro/
│   │   │   │   ├── solicitacoes/
│   │   │   │   └── layout.tsx
│   │   │   ├── layout.tsx           # Root layout
│   │   │   └── providers.tsx        # Providers centralizados
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/              # Wrappers HeroUI
│   │   │   │   ├── features/        # Componentes por feature
│   │   │   │   │   ├── clientes/
│   │   │   │   │   ├── obrigacoes/
│   │   │   │   │   └── financeiro/
│   │   │   │   └── shared/          # Componentes compartilhados
│   │   │   ├── lib/
│   │   │   │   ├── api/             # Cliente API organizado
│   │   │   │   │   ├── client.ts    # Fetch wrapper com interceptors
│   │   │   │   │   ├── endpoints/   # Um arquivo por domínio
│   │   │   │   │   └── types.ts     # Tipos da API
│   │   │   │   ├── ws/              # WebSocket client
│   │   │   │   ├── utils/           # Utilitários puros
│   │   │   │   └── validators/      # Validações Zod
│   │   │   ├── hooks/
│   │   │   │   ├── auth/
│   │   │   │   ├── data/            # Hooks de fetch/mutation
│   │   │   │   └── ui/              # Hooks de UI
│   │   │   ├── stores/              # Zustand stores (se necessário)
│   │   │   ├── types/               # Tipos TypeScript globais
│   │   │   │   ├── api.ts           # Espelho dos schemas Pydantic
│   │   │   │   ├── entities.ts
│   │   │   │   └── ui.ts
│   │   │   ├── styles/
│   │   │   │   └── globals.css
│   │   │   └── heroui.ts            # Barrel export
│   │   ├── public/
│   │   ├── tests/
│   │   │   ├── e2e/                 # Playwright
│   │   │   ├── integration/
│   │   │   └── unit/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # FastAPI Backend
│       ├── app/
│       │   ├── api/
│       │   │   ├── v1/              # Versionamento de API
│       │   │   │   ├── routes/
│       │   │   │   │   ├── auth.py
│       │   │   │   │   ├── clients.py
│       │   │   │   │   ├── obligations.py
│       │   │   │   │   ├── finance.py
│       │   │   │   │   ├── licenses.py
│       │   │   │   │   ├── reports.py
│       │   │   │   │   ├── activities.py
│       │   │   │   │   ├── requests.py
│       │   │   │   │   ├── notifications.py
│       │   │   │   │   └── audit.py
│       │   │   │   └── router.py    # Agregador de rotas
│       │   │   └── deps.py          # Dependencies globais
│       │   ├── core/
│       │   │   ├── config.py        # Settings (Singleton)
│       │   │   ├── container.py     # DI Container
│       │   │   ├── database.py      # Engines + SessionManager
│       │   │   ├── security.py      # JWT/bcrypt/RBAC
│       │   │   ├── exceptions.py    # Custom exceptions
│       │   │   ├── events.py        # Event bus interno
│       │   │   └── feature_flags.py # Feature toggles
│       │   ├── db/
│       │   │   ├── models/          # SQLAlchemy Models
│       │   │   │   ├── base.py      # Base declarativa
│       │   │   │   ├── user.py
│       │   │   │   ├── client.py
│       │   │   │   ├── obligation.py
│       │   │   │   ├── finance.py
│       │   │   │   ├── license.py
│       │   │   │   ├── report.py
│       │   │   │   ├── activity.py
│       │   │   │   ├── request.py
│       │   │   │   ├── notification.py
│       │   │   │   └── audit.py
│       │   │   ├── repositories/    # Repository pattern
│       │   │   │   ├── base.py      # Repo genérico
│       │   │   │   ├── client.py
│       │   │   │   ├── obligation.py
│       │   │   │   └── ...
│       │   │   └── session.py       # Gerenciador de sessão
│       │   ├── schemas/             # Pydantic Schemas
│       │   │   ├── base.py          # Schemas base
│       │   │   ├── auth.py
│       │   │   ├── client.py
│       │   │   ├── obligation.py
│       │   │   ├── finance.py
│       │   │   └── ...
│       │   ├── services/            # Regras de negócio
│       │   │   ├── auth.py
│       │   │   ├── client.py
│       │   │   ├── obligation.py
│       │   │   │   ├── generator.py # Geração de obrigações
│       │   │   │   ├── processor.py # Processamento/baixa
│       │   │   │   └── notifier.py  # Notificações
│       │   │   ├── finance.py
│       │   │   │   ├── transactions.py
│       │   │   │   ├── kpis.py
│       │   │   │   └── export.py
│       │   │   └── ...
│       │   ├── patterns/
│       │   │   ├── strategies/
│       │   │   │   ├── base.py
│       │   │   │   ├── commerce_rule.py
│       │   │   │   ├── service_rule.py
│       │   │   │   └── industry_rule.py
│       │   │   ├── factories/
│       │   │   │   ├── obligation_factory.py
│       │   │   │   └── transaction_factory.py
│       │   │   └── observers/       # Observer pattern para eventos
│       │   │       └── audit_observer.py
│       │   ├── utils/
│       │   │   ├── dates.py
│       │   │   ├── formatters.py
│       │   │   ├── validators.py
│       │   │   └── files.py
│       │   ├── websockets/
│       │   │   ├── manager.py       # ConnectionManager
│       │   │   ├── handlers.py
│       │   │   └── events.py
│       │   ├── middleware/
│       │   │   ├── auth.py
│       │   │   ├── logging.py
│       │   │   ├── timing.py
│       │   │   └── cors.py
│       │   └── main.py
│       ├── alembic/
│       │   ├── versions/
│       │   └── env.py
│       ├── tests/
│       │   ├── conftest.py
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── scripts/
│       │   ├── seed.py              # Dados iniciais
│       │   ├── backup.sh
│       │   └── migrate.sh
│       ├── alembic.ini
│       ├── pyproject.toml
│       └── pytest.ini
│
├── packages/                         # Pacotes compartilhados
│   ├── types/                       # Tipos compartilhados
│   │   ├── src/
│   │   │   ├── entities.ts
│   │   │   └── api.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── contracts/                   # Contratos OpenAPI/JSON Schema
│       └── openapi.yaml
│
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.api
│   │   └── Dockerfile.postgres
│   ├── docker-compose.dev.yml
│   ├── docker-compose.stage.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   ├── nginx.dev.conf
│   │   ├── nginx.stage.conf
│   │   └── nginx.prod.conf
│   ├── scripts/
│   │   ├── deploy.sh
│   │   ├── backup.sh
│   │   └── rollback.sh
│   └── ssl/                         # Certificados (gitignore)
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md               # Guia de desenvolvimento
│   ├── CONTRIBUTING.md
│   └── marcos/                      # Documentação por marco
│       ├── M01-fundacao.md
│       ├── M02-auth.md
│       ├── M03-clientes.md
│       └── ...
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy-stage.yml
│   │   └── deploy-prod.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .vscode/
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
│
├── package.json
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
└── README.md
```

---

## Blocos de Desenvolvimento para Claude Code

Agora vou dividir o projeto em blocos atômicos e sequenciais, perfeitos para desenvolvimento com Claude Code. Cada bloco tem escopo bem definido, entradas/saídas claras e pode ser desenvolvido independentemente quando possível.

### Filosofia da Divisão

Cada bloco segue o princípio TDD (Test-Driven Development) adaptado:

1. **Contracts First**: Definir tipos/schemas
2. **Tests**: Escrever testes
3. **Implementation**: Implementar funcionalidade
4. **Integration**: Integrar com sistema existente

---

## FASE 1: FUNDAÇÃO (Marcos 1 e 2 divididos em blocos)

### Bloco 1.1: Setup do Monorepo e Tooling
**Duração estimada**: 2-3 horas
**Dependências**: Nenhuma

**Objetivos**:
- Criar estrutura de monorepo com pnpm workspaces
- Configurar TypeScript com settings corretos
- Configurar ESLint e Prettier
- Criar scripts de desenvolvimento

**Entregáveis**:
```
✓ package.json (root) com workspaces
✓ .vscode/settings.json
✓ .eslintrc.js e .prettierrc
✓ tsconfig.base.json
✓ pnpm-workspace.yaml
✓ .gitignore completo
✓ README.md inicial
```

**Critérios de aceite**:
- `pnpm install` funciona em todos os workspaces
- ESLint roda sem erros em arquivos vazios
- TypeScript compila com strict mode

**Prompt sugerido para Claude Code**:
```
Preciso criar a estrutura base de um monorepo para um SaaS contábil com Next.js 16 e FastAPI. 

Requisitos técnicos:
- pnpm workspaces com apps/web e apps/api
- TypeScript com moduleResolution: "bundler", strict: true
- ESLint + Prettier configurados
- Scripts úteis de desenvolvimento

Por favor, crie todos os arquivos de configuração necessários seguindo as melhores práticas de 2025.
```

---

### Bloco 1.2: Setup Next.js 16 + HeroUI + Tailwind v4
**Duração estimada**: 3-4 horas
**Dependências**: Bloco 1.1

**Objetivos**:
- Inicializar Next.js 16 com App Router
- Integrar HeroUI com tema customizado
- Configurar Tailwind v4
- Implementar dark mode por padrão
- Criar barrel export centralizado

**Entregáveis**:
```
apps/web/
✓ next.config.ts
✓ tailwind.config.ts
✓ app/layout.tsx com providers
✓ app/providers.tsx (ThemeProvider + HeroUI)
✓ src/heroui.ts (barrel export)
✓ src/styles/globals.css
✓ app/page.tsx (landing temporária)
```

**Critérios de aceite**:
- `pnpm dev` abre aplicação em localhost:3000
- Dark mode ativo por padrão
- Todos os imports HeroUI funcionam via @/heroui
- Hot reload funcionando

**Prompt sugerido**:
```
Configure Next.js 16 no workspace apps/web com:
1. HeroUI como design system (usar heroui-cli)
2. Tailwind v4 com configuração CSS-first
3. Dark mode por padrão usando next-themes
4. Criar barrel export em src/heroui.ts que exporta tudo de @heroui/react
5. Configurar tsconfig.json com moduleResolution: "bundler"

Garanta que está seguindo a documentação oficial mais recente de cada tecnologia.
```

---

### Bloco 1.3: Setup FastAPI + SQLAlchemy + PostgreSQL
**Duração estimada**: 4-5 horas
**Dependências**: Bloco 1.1

**Objetivos**:
- Criar estrutura FastAPI com ASGI
- Configurar SQLAlchemy 2 async
- Setup Alembic para migrations
- Implementar Settings com pydantic-settings
- Database connection pool configurado

**Entregáveis**:
```
apps/api/
✓ pyproject.toml com dependências
✓ app/main.py
✓ app/core/config.py (Settings Singleton)
✓ app/core/database.py (engines write/read)
✓ app/db/models/base.py
✓ app/db/session.py
✓ alembic.ini
✓ alembic/env.py
✓ app/api/v1/routes/health.py
✓ tests/conftest.py
```

**Critérios de aceite**:
- `uvicorn app.main:app --reload` inicia em localhost:8000
- GET /health retorna 200 OK
- Alembic consegue detectar mudanças em models
- Connection pool configurado corretamente
- Testes unitários básicos passam

**Prompt sugerido**:
```
Configure FastAPI no workspace apps/api com:
1. SQLAlchemy 2 com suporte async (asyncpg)
2. Alembic para migrations
3. Pydantic Settings v2 para configuração
4. Estrutura preparada para write/read engines (hoje apontando para mesma DSN)
5. CORS configurado
6. Rota /health
7. Logging estruturado em JSON

Siga a arquitetura em camadas: core, db, api, services.
Use as melhores práticas de SQLAlchemy 2 async.
```

---

### Bloco 1.4: Docker Compose + Nginx (Ambiente Dev)
**Duração estimada**: 3-4 horas
**Dependências**: Blocos 1.2 e 1.3

**Objetivos**:
- Docker Compose para web + api + postgres
- Nginx como reverse proxy
- Hot reload funcional em containers
- Volumes configurados

**Entregáveis**:
```
infra/
✓ docker/Dockerfile.web
✓ docker/Dockerfile.api
✓ docker/Dockerfile.postgres
✓ docker-compose.dev.yml
✓ nginx/nginx.dev.conf
✓ scripts/dev-up.sh
✓ scripts/dev-down.sh
```

**Critérios de aceite**:
- `docker compose up` sobe todos os serviços
- Nginx roteia / para web e /api para api
- Hot reload funciona em ambos
- PostgreSQL persiste dados em volume
- Logs acessíveis

**Prompt sugerido**:
```
Crie configuração Docker Compose para desenvolvimento com:
1. Serviço web (Next.js) com hot reload
2. Serviço api (FastAPI) com hot reload
3. Serviço postgres (PostgreSQL 16)
4. Serviço nginx como reverse proxy
5. Networks e volumes apropriados
6. Health checks

Garanta que o hot reload funcione corretamente com volumes montados.
```

---

### Bloco 1.5: Páginas Base (Login e Clientes Mock)
**Duração estimada**: 4-5 horas
**Dependências**: Blocos 1.2, 1.3, 1.4

**Objetivos**:
- Página de login com form HeroUI
- Página de clientes com tabela mock
- Filtros reativos básicos
- Snippet copy component
- Navegação básica

**Entregáveis**:
```
apps/web/app/
✓ (auth)/login/page.tsx
✓ (auth)/layout.tsx
✓ (dashboard)/clientes/page.tsx
✓ (dashboard)/layout.tsx (sidebar/header)
apps/web/src/components/
✓ ui/DataTable.tsx (wrapper HeroUI Table)
✓ ui/SnippetCopy.tsx
✓ ui/SearchInput.tsx
✓ features/clientes/ClientsTable.tsx
✓ features/clientes/ClientsFilters.tsx
```

**Critérios de aceite**:
- Login renderiza form estilizado (ainda sem funcionalidade)
- Tabela de clientes mostra dados mock
- Busca filtra localmente
- Snippet copy funciona para CNPJ/email
- Layout responsivo mobile/desktop
- Dark mode ativo

**Prompt sugerido**:
```
Crie páginas iniciais usando apenas componentes HeroUI:

1. Página /auth/login com:
   - Form de email/senha
   - Botão de submit estilizado
   - Link "Esqueci senha"
   
2. Página /clientes com:
   - Tabela HeroUI com dados mock (10 clientes)
   - Campos: razão social, CNPJ, email, status, honorários
   - Input de busca que filtra localmente
   - Componente Snippet para copiar CNPJ/email
   - Filtros por status
   
3. Layout dashboard com:
   - Sidebar com navegação
   - Header com user menu (mock)
   - Responsivo (collapse sidebar em mobile)

Todos os imports devem ser de @/heroui.
```

---

### Bloco 2.1: Contracts de Auth (Tipos e Schemas)
**Duração estimada**: 2 horas
**Dependências**: Bloco 1.3

**Objetivos**:
- Definir schemas Pydantic para auth
- Definir tipos TypeScript correspondentes
- Documentar contrato da API

**Entregáveis**:
```
apps/api/app/schemas/
✓ auth.py (LoginRequest, TokenResponse, RefreshRequest)
✓ user.py (UserCreate, UserUpdate, UserResponse)

apps/web/src/types/
✓ auth.ts (interfaces correspondentes)
✓ user.ts

docs/
✓ contracts/auth-api.md
```

**Critérios de aceite**:
- Schemas Pydantic validam corretamente
- Tipos TypeScript sincronizados
- Documentação clara de endpoints
- Exemplos de request/response

**Prompt sugerido**:
```
Defina contratos completos para autenticação:

Backend (Pydantic v2):
- LoginRequest (email, password)
- TokenResponse (access_token, refresh_token, token_type, expires_in, user)
- RefreshRequest (refresh_token)
- UserCreate, UserUpdate, UserResponse com role enum

Frontend (TypeScript):
- Interfaces correspondentes a todos schemas
- Enum Role sincronizado

Documente os endpoints:
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET /api/v1/users/me
```

---

### Bloco 2.2: Database Models de Auth
**Duração estimada**: 3 horas
**Dependências**: Bloco 1.3, 2.1

**Objetivos**:
- Model User com SQLAlchemy 2
- Migration inicial
- Seed de usuário admin
- Testes de models

**Entregáveis**:
```
apps/api/app/db/models/
✓ user.py (User model com role, password_hash, etc)
✓ audit.py (AuditLog model)

apps/api/alembic/versions/
✓ 001_initial_users.py

apps/api/scripts/
✓ seed.py

apps/api/tests/unit/models/
✓ test_user.py
```

**Critérios de aceite**:
- Migration cria tabelas corretamente
- Seed cria admin@example.com
- Password não é armazenado em plain text
- Timestamps automáticos funcionam
- Testes unitários passam

**Prompt sugerido**:
```
Crie models SQLAlchemy 2 async para:

1. User:
   - id (UUID primary key)
   - name, email (unique), password_hash
   - role (enum: admin, func, cliente)
   - is_active, is_verified
   - last_login_at
   - created_at, updated_at (automáticos)
   - Métodos: verify_password, set_password

2. AuditLog:
   - id (UUID)
   - user_id (FK)
   - action, entity, entity_id
   - payload (JSONB)
   - ip_address, user_agent
   - created_at

Crie migration Alembic e script de seed que cria:
- admin@example.com / admin123 (role: admin)

Inclua testes unitários para o model User.
```

---

### Bloco 2.3: Core Security (JWT + Bcrypt + RBAC)
**Duração estimada**: 4-5 horas
**Dependências**: Bloco 2.2

**Objetivos**:
- Implementar hash/verificação de senha
- Gerar/validar JWT access e refresh tokens
- Dependencies RBAC
- Middleware de autenticação

**Entregáveis**:
```
apps/api/app/core/
✓ security.py (hash, verify, create_tokens, decode_token)
✓ deps.py (get_current_user, require_role)

apps/api/app/middleware/
✓ auth.py

apps/api/tests/unit/core/
✓ test_security.py
```

**Critérios de aceite**:
- bcrypt funciona corretamente
- JWT gerado e validado
- Refresh token tem duração maior
- Dependency require_role bloqueia acesso
- Testes cobrem casos de sucesso e erro

**Prompt sugerido**:
```
Implemente módulo de segurança FastAPI:

1. app/core/security.py:
   - hash_password(password: str) -> str
   - verify_password(plain: str, hashed: str) -> bool
   - create_access_token(data: dict) -> str (30min)
   - create_refresh_token(data: dict) -> str (7 dias)
   - decode_token(token: str) -> dict
   
2. app/core/deps.py:
   - async get_current_user(token: Annotated[str, Depends(oauth2_scheme)])
   - async get_current_active_user
   - require_role(roles: list[str])
   
3. Middleware opcional que adiciona user ao request state

Use python-jose para JWT, bcrypt para hash.
Inclua testes completos.
```

---

### Bloco 2.4: Auth Routes (Backend)
**Duração estimada**: 4 horas
**Dependências**: Blocos 2.1, 2.2, 2.3

**Objetivos**:
- Implementar rotas de auth
- Repository pattern para User
- Service layer para lógica de negócio
- Auditoria de login

**Entregáveis**:
```
apps/api/app/db/repositories/
✓ user.py (UserRepository)

apps/api/app/services/
✓ auth.py (AuthService)

apps/api/app/api/v1/routes/
✓ auth.py (login, refresh, logout)
✓ users.py (me, create, update)

apps/api/tests/integration/
✓ test_auth_routes.py
```

**Critérios de aceite**:
- POST /auth/login retorna tokens válidos
- POST /auth/refresh funciona
- GET /users/me retorna usuário autenticado
- Login incorreto retorna 401
- Auditoria registra logins
- Testes de integração passam

**Prompt sugerido**:
```
Implemente rotas de autenticação seguindo arquitetura em camadas:

1. Repository (app/db/repositories/user.py):
   - get_by_email, get_by_id
   - create, update
   - Usa SQLAlchemy async session

2. Service (app/services/auth.py):
   - authenticate(email, password) -> User
   - create_tokens(user) -> dict
   - refresh_access_token(refresh_token) -> dict
   - Chama repository, lida com lógica

3. Routes (app/api/v1/routes/auth.py):
   - POST /login
   - POST /refresh
   - POST /logout (opcional)
   
4. Routes (app/api/v1/routes/users.py):
   - GET /me (protegida)
   - POST / (admin only)
   - PUT /:id (admin or self)

Adicione registro de auditoria em logins bem-sucedidos.
Inclua testes de integração com TestClient.
```

---

### Bloco 2.5: Auth Frontend (Hook + Guard + Storage)
**Duração estimada**: 4-5 horas
**Dependências**: Blocos 1.5, 2.4

**Objetivos**:
- Hook useAuth com state management
- Interceptor fetch para refresh automático
- Guards de rota
- Integrar página de login

**Entregáveis**:
```
apps/web/src/lib/api/
✓ client.ts (fetch wrapper com interceptors)
✓ endpoints/auth.ts

apps/web/src/hooks/auth/
✓ useAuth.ts
✓ AuthContext.tsx

apps/web/src/middleware.ts
✓ (guard de rotas protegidas)

apps/web/app/
✓ providers.tsx (incluir AuthProvider)
✓ (auth)/login/page.tsx (integrado)
✓ (dashboard)/layout.tsx (protegido)
```

**Critérios de aceite**:
- Login funcional salva tokens
- Refresh automático antes de expirar
- Guard redireciona não-autenticados para /auth/login
- Estado de auth persistente (memory + localStorage para refresh)
- Loading states adequados
- Logout limpa estado

**Prompt sugerido**:
```
Implemente autenticação no frontend:

1. API Client (src/lib/api/client.ts):
   - Fetch wrapper que adiciona Authorization header
   - Interceptor que detecta 401 e tenta refresh
   - Queue de requests durante refresh
   
2. Auth Hook (src/hooks/auth/useAuth.ts):
   - Context com user, login, logout, refresh
   - Armazena access_token em memory
   - Armazena refresh_token em localStorage
   - Refresh automático antes de expirar
   
3. Middleware (middleware.ts):
   - Protege rotas de (dashboard)
   - Permite (auth) sem autenticação
   
4. Integração:
   - Conecte /auth/login com API
   - Adicione user menu no dashboard layout
   - Loading states durante auth

Use apenas hooks nativos ou zustand (sem Redux).
```

---

### Bloco 2.6: RBAC Frontend + Auditoria Completa
**Duração estimada**: 3 horas
**Dependências**: Bloco 2.5

**Objetivos**:
- Componente Can para conditional rendering
- Auditoria completa backend
- Filtros de auditoria

**Entregáveis**:
```
apps/web/src/components/shared/
✓ Can.tsx (conditional render por role)

apps/api/app/services/
✓ audit.py (AuditService)

apps/api/app/api/v1/routes/
✓ audit.py (listagem com filtros)

apps/web/app/(dashboard)/auditoria/
✓ page.tsx
```

**Critérios de aceite**:
- Componente Can esconde elementos por role
- Backend registra ações importantes
- API de auditoria retorna logs paginados
- Frontend mostra logs filtráveis (admin only)

**Prompt sugerido**:
```
1. Criar componente Can no frontend:
   - Recebe roles permitidos
   - Só renderiza children se user.role estiver na lista
   - Exemplo: <Can roles={['admin']}><DeleteButton /></Can>

2. Implementar serviço de auditoria no backend:
   - log_action(user, action, entity, entity_id, payload)
   - get_logs com filtros (entity, user, date_range)
   
3. Criar rota GET /api/v1/audit (admin only)

4. Página de auditoria no frontend (admin only)
```

---

## FASE 2: CLIENTES PRO (Marco 3)

### Bloco 3.1: Contracts de Clientes
**Duração estimada**: 2 horas

**Entregáveis**:
```
✓ schemas/client.py (Pydantic)
✓ types/client.ts (TypeScript)
✓ docs/contracts/client-api.md
```

**Prompt**: 
```
Defina contratos para módulo de clientes:
- ClientCreate, ClientUpdate, ClientResponse, ClientListResponse
- Filtros: query, status, razao_social_starts_with, page, size
- Endpoints: GET /clients, POST /clients, GET /clients/:id, PUT /clients/:id
```

---

### Bloco 3.2: Models e Migrations de Clientes
**Duração estimada**: 3 horas

**Entregáveis**:
```
✓ models/client.py
✓ models/attachment.py
✓ migrations/002_clients.py
✓ tests/unit/models/test_client.py
```

**Prompt**:
```
Crie model Client com SQLAlchemy 2:
- Campos do PRD (razao_social, cnpj unique, email, honorarios, status, etc)
- Relacionamento com attachments (one-to-many)
- Índices: cnpj, razao_social (text_pattern_ops), status
- Migration e testes
```

---

### Bloco 3.3: Repository e Service de Clientes
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ repositories/client.py
✓ services/client.py
✓ tests/unit/services/test_client.py
```

**Prompt**:
```
Implemente:
1. ClientRepository com métodos:
   - list_with_filters (query, status, pagination)
   - get_by_id, get_by_cnpj
   - create, update, soft_delete
   - Busca deve usar ILIKE para razao_social/query

2. ClientService com lógica:
   - Validação de CNPJ (formato)
   - Regras de negócio (não permitir CNPJ duplicado)
   - Integração com auditoria

3. Testes unitários completos
```

---

### Bloco 3.4: Routes de Clientes (Backend)
**Duração estimada**: 3 horas

**Entregáveis**:
```
✓ routes/clients.py
✓ tests/integration/test_clients_routes.py
```

**Prompt**:
```
Implementar rotas RESTful de clientes:
- GET /clients (list com filtros, paginação)
- POST /clients (admin/func only)
- GET /clients/:id
- PUT /clients/:id (admin/func only)
- DELETE /clients/:id (soft delete, admin only)
- GET /clients/:id/documents (listar attachments)

Incluir testes de integração para todos endpoints.
```

---

### Bloco 3.5: DataTable Avançado (Frontend)
**Duração estimada**: 5 horas

**Entregáveis**:
```
✓ components/ui/DataTable.tsx (genérico)
✓ components/features/clientes/ClientsTable.tsx
✓ components/features/clientes/ClientsFilters.tsx
✓ hooks/data/useClients.ts
```

**Prompt**:
```
Criar componente DataTable genérico reutilizável com HeroUI:
- Paginação server-side
- Sorting por coluna
- Loading states
- Empty states
- Row selection (opcional)

Depois usar em ClientsTable com:
- Colunas: razão social, CNPJ (com Snippet), email (com Snippet), status, honorários
- Filtros: busca, status, A-Z
- Integração com API real via useClients hook
```

---

### Bloco 3.6: Autocomplete e Busca Inteligente
**Duração estimada**: 3 horas

**Entregáveis**:
```
✓ components/ui/Autocomplete.tsx
✓ hooks/data/useClientSearch.ts
✓ Integração na busca de clientes
```

**Prompt**:
```
Criar componente Autocomplete com HeroUI que:
- Debounce de 300ms
- Mostra loading durante busca
- Destaca termo buscado
- Navega com teclado
- Integra com API de busca

Endpoint backend: GET /clients/search?q=termo&limit=10
```

---

### Bloco 3.7: Drawer de Detalhes
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ components/features/clientes/ClientDrawer.tsx
✓ components/features/clientes/ClientForm.tsx
✓ Integração com tabela
```

**Prompt**:
```
Criar Drawer lateral (HeroUI Modal ou custom) que:
- Abre ao clicar em linha da tabela
- Mostra detalhes completos do cliente
- Abas: Dados, Documentos, Histórico
- Botão editar que abre form inline
- Form de edição com validação Zod
- Submit otimista (atualiza UI antes da resposta)
```

---

### Bloco 3.8: Upload de Documentos
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ routes/attachments.py (backend)
✓ services/file_storage.py
✓ components/ui/FileUpload.tsx
✓ Integração no ClientDrawer
```

**Prompt**:
```
Implementar upload de documentos:

Backend:
- POST /attachments (multipart/form-data)
- Validação de tipo (pdf, docx, xlsx, png, jpg)
- Tamanho máximo 10MB
- Armazenamento em /var/uploads/{entity_type}/{entity_id}/
- Registro em tabela attachments

Frontend:
- Componente drag-and-drop
- Preview antes de enviar
- Progress bar
- Lista de arquivos enviados
- Download de arquivo
```

---

## FASE 3: OBRIGAÇÕES (Marco 4)

[Continuo com a mesma lógica de blocos para os próximos marcos]

### Bloco 4.1: Contracts e Models de Obrigações
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ models/obligation.py
✓ models/obligation_type.py
✓ models/obligation_receipt.py
✓ models/obligation_event.py
✓ schemas/obligation.py
✓ migrations/003_obligations.py
```

---

### Bloco 4.2: Strategy Pattern (Regras por Tipo)
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ patterns/strategies/base.py
✓ patterns/strategies/commerce_rule.py
✓ patterns/strategies/service_rule.py
✓ patterns/strategies/industry_rule.py
✓ tests/unit/patterns/test_strategies.py
```

---

### Bloco 4.3: Factory de Obrigações
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ patterns/factories/obligation_factory.py
✓ services/obligation/generator.py
✓ tests/unit/patterns/test_obligation_factory.py
```

---

### Bloco 4.4: Geração Mensal (Endpoint)
**Duração estimada**: 3 horas

**Entregáveis**:
```
✓ routes/obligations.py (POST /generate)
✓ Seed de tipos de obrigações
✓ tests/integration/test_obligation_generation.py
```

---

### Bloco 4.5: Processo de Baixa (com Anexo Obrigatório)
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ services/obligation/processor.py
✓ routes/obligations.py (POST /:id/receipt)
✓ Validação de anexo obrigatório
✓ tests/integration/test_obligation_receipt.py
```

---

### Bloco 4.6: Timeline de Eventos
**Duração estimada**: 3 horas

**Entregáveis**:
```
✓ services/obligation/events.py
✓ routes/obligations.py (GET /:id/events)
✓ components/features/obrigacoes/ObligationTimeline.tsx
```

---

### Bloco 4.7: Interface de Obrigações (Dashboard)
**Duração estimada**: 5 horas

**Entregáveis**:
```
✓ app/(dashboard)/obrigacoes/page.tsx
✓ components/features/obrigacoes/ObligationsTable.tsx
✓ components/features/obrigacoes/ObligationFilters.tsx
✓ components/features/obrigacoes/ObligationCard.tsx
✓ hooks/data/useObligations.ts
```

---

### Bloco 4.8: Portal do Cliente (Obrigações)
**Duração estimada**: 4 horas

**Entregáveis**:
```
✓ routes/portal/obligations.py
✓ app/(portal)/obrigacoes/page.tsx
✓ components/features/portal/ObligationsView.tsx
```

---

## Resumo da Estratégia de Blocos

Organizei os blocos seguindo esses princípios:

**1. Contracts First**: Todo módulo começa definindo contratos (tipos/schemas) antes de implementar. Isso permite que frontend e backend possam trabalhar em paralelo usando mocks.

**2. Vertical Slices**: Cada bloco entrega valor completo em uma fatia vertical (model → repository → service → route → UI). Evita trabalho em "camadas horizontais" que não entregam valor visível.

**3. Test-First Mindset**: Cada bloco inclui testes apropriados à camada. Models têm testes unitários, services têm testes unitários e de integração, routes têm testes de integração.

**4. Incremental Complexity**: Blocos iniciais são mais simples e estabelecem fundação. Complexidade aumenta gradualmente.

**5. Clear Dependencies**: Cada bloco lista dependências explícitas. Claude Code pode verificar se blocos anteriores estão completos.

**6. Atomic Commits**: Cada bloco resulta em 1-3 commits atômicos que podem ser revertidos sem quebrar o sistema.

**7. Documentation as Code**: Cada bloco atualiza documentação relevante.

---

## Recomendações Adicionais para Claude Code

### Estratégia de Prompts

Para cada bloco, estruture o prompt assim:

```
CONTEXTO: [Explique em 2-3 frases onde estamos no projeto]

OBJETIVO: [O que este bloco deve entregar]

REQUISITOS TÉCNICOS:
- [Lista de requisitos específicos]
- [Padrões a seguir]
- [Constraints importantes]

ENTREGÁVEIS:
- [Lista exata de arquivos/funcionalidades]

CRITÉRIOS DE ACEITE:
- [Como validar que está completo]
- [Testes que devem passar]

REFERÊNCIAS:
- [Links para docs oficiais relevantes]
- [Blocos anteriores relacionados]
```

### Validação Entre Blocos

Após completar cada bloco, rode este checklist:

```bash
# Lint
pnpm lint

# Type check
pnpm type-check

# Tests
pnpm test

# Build
pnpm build

# Local run
docker compose up
```

### Git Strategy

Cada bloco deve resultar em um ou mais commits seguindo Conventional Commits:

```
feat(auth): implement JWT token generation and validation

- Add security.py with bcrypt password hashing
- Implement JWT access and refresh token creation
- Add token validation with expiry check
- Include unit tests with 95% coverage

Refs: Bloco 2.3
```

### Gestão de Estado de Progresso

Crie arquivo `.claude/progress.json`:

```json
{
  "marco_atual": 2,
  "bloco_atual": "2.5",
  "blocos_completos": ["1.1", "1.2", "1.3", "1.4", "1.5", "2.1", "2.2", "2.3", "2.4"],
  "blocos_em_andamento": ["2.5"],
  "blockers": [],
  "notas": "Auth backend completo. Trabalhando em integração frontend."
}
```

Claude Code pode ler este arquivo para entender contexto.

### Documentação Viva

Mantenha `docs/DEVELOPMENT.md` atualizado com:

- Qual bloco está sendo trabalhado
- Decisões técnicas tomadas
- Problemas encontrados e soluções
- Comandos úteis
- Variáveis de ambiente necessárias

---
