# 🚀 Comandos para Testar o Marco 1

## ⚠️ Importante
O Marco 1 foi executado completamente conforme PRD.md. Todos os arquivos foram criados e o sistema está funcional.

---

## 🎯 Opção 1: Teste Local Rápido (SEM Banco de Dados)

### Frontend (Next.js)
```powershell
# Terminal 1 - Frontend
cd apps/web
pnpm install
pnpm dev
```

Acessar: **http://localhost:3000**

- ✅ Página inicial com links
- ✅ Login (form estático, sem funcionalidade ainda)
- ✅ Clientes (10 registros mock com filtros funcionando)
- ✅ Dark mode ativo

### Backend (FastAPI - Health Check apenas)
```powershell
# Terminal 2 - Backend (sem banco)
cd apps/api
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Acessar:
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/v1/health

---

## 🐳 Opção 2: Teste Completo com Docker (COM Banco de Dados)

### Passo 1: Subir todos os serviços via Docker

```powershell
# Na raiz do projeto
docker compose -f infra/docker-compose.dev.yml up --build -d
```

Aguarde 30-60 segundos para todos os serviços iniciarem.

### Passo 2: Verificar se está tudo rodando

```powershell
docker compose -f infra/docker-compose.dev.yml ps
```

Você deve ver 4 serviços rodando:
- `contabil-postgres-dev` (porta 5432)
- `contabil-api-dev` (porta 8000)
- `contabil-web-dev` (porta 3000)
- `contabil-nginx-dev` (porta 80)

### Passo 3: Criar seed de usuários

```powershell
# Entrar no container da API
docker compose -f infra/docker-compose.dev.yml exec api python -m scripts.seed_users
```

**Usuários criados**:
```
Email: admin@contabil.com           | Password: admin123      | Role: admin
Email: contabilista@contabil.com    | Password: contabil123   | Role: contabilista
Email: assistente@contabil.com      | Password: assist123     | Role: assistente
Email: cliente@empresa.com          | Password: cliente123    | Role: cliente
```

### Passo 4: Acessar o sistema

- **Frontend (via Nginx)**: http://localhost
- **Frontend (direto)**: http://localhost:3000
- **API (via Nginx)**: http://localhost/api/v1/health
- **API (direto)**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Ver Logs

```powershell
# Todos os logs
docker compose -f infra/docker-compose.dev.yml logs -f

# Log específico
docker compose -f infra/docker-compose.dev.yml logs -f api
docker compose -f infra/docker-compose.dev.yml logs -f web
docker compose -f infra/docker-compose.dev.yml logs -f postgres
```

### Parar serviços

```powershell
docker compose -f infra/docker-compose.dev.yml down
```

---

## 🗄️ Opção 3: PostgreSQL Local (Sem Docker)

Se você já tem PostgreSQL instalado localmente:

### Passo 1: Criar banco de dados

```sql
-- Conectar ao PostgreSQL
psql -U postgres

-- Criar database
CREATE DATABASE contabil_db;

-- Criar user
CREATE USER contabil WITH PASSWORD 'contabil123';

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE contabil_db TO contabil;
```

### Passo 2: Configurar .env no backend

```powershell
# Copiar exemplo
cd apps/api
copy .env.example .env
```

Editar `.env` e verificar:
```env
DATABASE_URL=postgresql+asyncpg://contabil:contabil123@localhost:5432/contabil_db
```

### Passo 3: Criar seed de usuários

```powershell
cd apps/api
venv\Scripts\activate
python -m scripts.seed_users
```

### Passo 4: Rodar backend

```powershell
uvicorn app.main:app --reload
```

---

## 🧪 Testando Funcionalidades

### 1. Página Inicial
- Acessar: http://localhost:3000
- Ver card de boas-vindas com botões
- Links para Login e Clientes

### 2. Login (Mock - sem funcionalidade ainda)
- Acessar: http://localhost:3000/login
- Ver formulário estilizado
- Background gradiente
- Campos: email e senha

### 3. Clientes (Mock - 10 registros)
- Acessar: http://localhost:3000/clientes
- Ver tabela com 10 clientes
- **Buscar**: Digitar "ABC" ou "12.345" no campo de busca
- **Filtrar**: Selecionar status (Ativo, Inativo, Pendente)
- **Ordenar**: Clicar em A-Z ou Z-A
- **Copiar**: Clicar no ícone ao lado do CNPJ ou email
- Ver status badges coloridos
- Ver honorários formatados em R$

### 4. API Health Check
- Acessar: http://localhost:8000/api/v1/health
- Ver resposta JSON: `{"status":"ok","message":"API is running"}`

### 5. API Docs (Swagger)
- Acessar: http://localhost:8000/docs
- Ver documentação interativa da API
- Testar endpoint `/api/v1/health`

### 6. Dark Mode
- Todo o sistema está em dark mode por padrão
- Tema consistente em todas as páginas

---

## 🛠️ Comandos Úteis

### Frontend (Next.js)

```powershell
cd apps/web

# Instalar dependências
pnpm install

# Desenvolvimento com Turbopack
pnpm dev

# Build de produção
pnpm build

# Lint
pnpm lint

# Type check
pnpm type-check
```

### Backend (FastAPI)

```powershell
cd apps/api

# Ativar venv
venv\Scripts\activate

# Instalar dependências
pip install -e ".[dev]"

# Desenvolvimento
uvicorn app.main:app --reload

# Testes
pytest

# Lint
black .
flake8 .
```

### Docker

```powershell
# Subir tudo
docker compose -f infra/docker-compose.dev.yml up -d

# Ver status
docker compose -f infra/docker-compose.dev.yml ps

# Ver logs
docker compose -f infra/docker-compose.dev.yml logs -f

# Parar tudo
docker compose -f infra/docker-compose.dev.yml down

# Parar e remover volumes
docker compose -f infra/docker-compose.dev.yml down -v

# Rebuild completo
docker compose -f infra/docker-compose.dev.yml up --build --force-recreate
```

---

## 📊 Checklist de Validação

- [ ] Frontend inicia em http://localhost:3000
- [ ] Página inicial mostra card de boas-vindas
- [ ] Login renderiza formulário estilizado
- [ ] Clientes mostra tabela com 10 registros
- [ ] Busca filtra clientes localmente
- [ ] Filtro por status funciona
- [ ] Ordenação A-Z e Z-A funciona
- [ ] Snippet copy funciona para CNPJ/email
- [ ] Backend inicia em http://localhost:8000
- [ ] GET /health retorna 200 OK
- [ ] GET /api/v1/health retorna {"status":"ok"}
- [ ] API Docs acessível em /docs
- [ ] Dark mode ativo em todas as páginas
- [ ] Layout responsivo funciona

---

## 🆘 Resolução de Problemas

### "pnpm: command not found"
```powershell
npm install -g pnpm
```

### "uvicorn: command not found"
```powershell
cd apps/api
venv\Scripts\activate
pip install uvicorn
```

### "Port 3000 already in use"
```powershell
# Matar processo na porta 3000
npx kill-port 3000
```

### "Port 8000 already in use"
```powershell
# Matar processo na porta 8000
npx kill-port 8000
```

### Docker não inicia
```powershell
# Verificar se Docker Desktop está rodando
docker ps

# Recriar volumes
docker compose -f infra/docker-compose.dev.yml down -v
docker compose -f infra/docker-compose.dev.yml up --build
```

### PostgreSQL connection error
```powershell
# Verificar se PostgreSQL está rodando (Docker)
docker compose -f infra/docker-compose.dev.yml ps postgres

# Ou verificar localmente
psql -U postgres -c "SELECT 1"
```

---

## 🎯 O que foi entregue (Marco 1)

✅ **Bloco 1.1**: Monorepo com pnpm workspaces
✅ **Bloco 1.2**: Next.js 16 + HeroUI + Tailwind v4
✅ **Bloco 1.3**: FastAPI + SQLAlchemy 2 + PostgreSQL
✅ **Bloco 1.4**: Docker Compose + Nginx
✅ **Bloco 1.5**: Páginas Base (Login e Clientes Mock)

**Todos os blocos foram executados conforme PRD.md!**

---

## 📝 Observações

1. **Login**: O formulário é apenas visual. A funcionalidade de autenticação será implementada no Marco 2.

2. **Clientes**: Os dados são mock (10 clientes estáticos). A integração com API será no Marco 2.

3. **Seed de Usuários**: Só funciona se PostgreSQL estiver rodando. Se usar Opção 1 (teste rápido), não precisa de seed.

4. **Docker**: É a forma mais completa de testar, mas também funciona localmente sem Docker.

---

_Este guia foi gerado automaticamente após conclusão do Marco 1 - 2025-10-30_
