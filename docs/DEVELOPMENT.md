# Documentação de Desenvolvimento - SaaS Contábil

## 📋 Status Atual do Projeto

**Marco Atual**: 1 - FASE 1: FUNDAÇÃO
**Bloco em Trabalho**: Iniciando
**Última Atualização**: 2025-10-30

---

## 🎯 Objetivo do Marco 1

Estabelecer a fundação completa do projeto:

- Estrutura de monorepo configurada
- Next.js 16 + HeroUI + Tailwind v4 funcionando
- FastAPI + SQLAlchemy + PostgreSQL configurado
- Ambiente Docker completo
- Páginas base com componentes mock

---

## 🏗️ Arquitetura do Projeto

### Monorepo Structure

```
/ (monorepo-saas-contabil)
├── apps/
│   ├── web/          # Next.js 16 App (Frontend)
│   └── api/          # FastAPI Backend
├── packages/         # Pacotes compartilhados
├── infra/           # Docker e configurações
└── docs/            # Documentação
```

### Tech Stack Principal

**Frontend**:

- Next.js 16 (App Router)
- HeroUI (Design System)
- Tailwind v3 (CSS-first)
- TypeScript (strict mode)
- Turbopack (build tool)

**Backend**:

- FastAPI (Python)
- SQLAlchemy 2 (async)
- PostgreSQL 16
- Alembic (migrations)
- Pydantic v2 (schemas)

**Infraestrutura**:

- Docker Compose
- Nginx (reverse proxy)
- pnpm workspaces

---

## 🔧 Setup do Ambiente de Desenvolvimento

### Pré-requisitos

```bash
# Node.js 18.17.x ou superior
node --version

# pnpm
npm install -g pnpm

# Python 3.11+
python --version

# Docker e Docker Compose
docker --version
docker compose version

# HeroUI CLI (opcional global)
npm install -g heroui-cli
```

### Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```env
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/contabil
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Comandos Principais

```bash
# Instalar dependências (root)
pnpm install

# Desenvolvimento - Web
cd apps/web
pnpm dev

# Desenvolvimento - API
cd apps/api
uvicorn app.main:app --reload

# Docker Compose (todos os serviços)
docker compose -f infra/docker-compose.dev.yml up

# Lint
pnpm lint

# Type check
pnpm type-check

# Tests
pnpm test

# Build
pnpm build
```

---

## 📦 Blocos de Desenvolvimento

### ✅ Blocos Completos

_(Nenhum bloco completado ainda)_

### 🔄 Bloco em Andamento

**Nenhum** - Aguardando início

### 📋 Próximos Blocos

1. **Bloco 1.1**: Setup do Monorepo e Tooling
2. **Bloco 1.2**: Setup Next.js 16 + HeroUI + Tailwind v4
3. **Bloco 1.3**: Setup FastAPI + SQLAlchemy + PostgreSQL
4. **Bloco 1.4**: Docker Compose + Nginx
5. **Bloco 1.5**: Páginas Base (Login e Clientes Mock)

---

## 🚨 Decisões Técnicas Importantes

### Banco de Dados

- ✅ **PostgreSQL via Docker** (sempre)
- ❌ **NUNCA usar SQLite**
- Se houver problemas de conexão, criar novo container e excluir o antigo

### HeroUI

- ✅ Usar HeroUI CLI: `npx heroui-cli@latest add [componente]`
- ✅ Pacote correto: `heroui-cli` (SEM @)
- ✅ Barrel export centralizado em `src/heroui.ts`

### Build Tools

- ✅ **Turbopack** (Next.js 15+)
- ❌ **NUNCA usar Webpack**
- Comando dev: `next dev --turbopack`

### TypeScript

- ✅ `moduleResolution: "bundler"`
- ✅ `strict: true`
- ✅ Todos os arquivos com tipos explícitos

### Padrões de Código

- Seguir Conventional Commits
- ESLint + Prettier configurados
- Tests obrigatórios para services e routes
- Documentação inline quando necessário

---

## 🐛 Problemas Conhecidos e Soluções

_(Será atualizado conforme problemas forem encontrados)_

---

## 📚 Referências

### Documentação Oficial

- [Next.js 15 Docs](https://nextjs.org/docs)
- [HeroUI Docs](https://www.heroui.com/docs)
- [Tailwind v4 Docs](https://tailwindcss.com/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2 Docs](https://docs.sqlalchemy.org/en/20/)
- [Pydantic v2 Docs](https://docs.pydantic.dev/latest/)

### PRD e Arquitetura

- [PRD Completo](./PRD.md)
- [Estrutura Detalhada](./PRD.md#estrutura-de-projeto-otimizada)
- [Blocos de Desenvolvimento](./PRD.md#blocos-de-desenvolvimento-para-claude-code)

---

## 📝 Log de Desenvolvimento

### 2025-10-30

- ✅ Criado arquivo de gestão de estado (`.claude/progress.json`)
- ✅ Criado documentação viva (`docs/DEVELOPMENT.md`)
- 🔄 Iniciando Bloco 1.1: Setup do Monorepo e Tooling

---

## ✅ Checklist de Validação Entre Blocos

Executar após completar cada bloco:

```bash
# 1. Lint
pnpm lint

# 2. Type check
pnpm type-check

# 3. Tests
pnpm test

# 4. Build
pnpm build

# 5. Local run
docker compose -f infra/docker-compose.dev.yml up

# 6. Health check
curl http://localhost/health  # Nginx
curl http://localhost:8000/health  # API
curl http://localhost:3000  # Web
```

---

## 🎯 Próximos Passos

1. Executar Bloco 1.1 - Setup do Monorepo
2. Executar Bloco 1.2 - Setup Next.js
3. Executar Bloco 1.3 - Setup FastAPI
4. Executar Bloco 1.4 - Docker Compose
5. Executar Bloco 1.5 - Páginas Base
6. Validação completa do Marco 1
7. Iniciar Marco 2 (Auth)

---

_Última atualização: 2025-10-30_
