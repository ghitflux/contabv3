# Quick Start - ContabilConsult

Guia rápido para iniciar o ambiente de desenvolvimento.

## Pré-requisitos

- Docker Desktop instalado e rodando
- Git configurado
- Porta 8000 e 5432 disponíveis

## Iniciar Projeto (Primeira vez)

### 1. Clonar repositório
```bash
git clone <repo-url>
cd ContabilConsult
```

### 2. Iniciar containers
```bash
docker compose up -d
```

Isso irá:
- Criar network `consultcontabil-network`
- Criar volumes `consultcontabil_postgres_data` e `consultcontabil_api_uploads`
- Iniciar container PostgreSQL (`ConsultContabil-postgres`)
- Executar migrações do banco
- Iniciar container API (`ConsultContabil-api`)

### 3. Aguardar API iniciar
```bash
docker logs -f ConsultContabil-api
```

Aguarde até ver:
```
INFO:     Application startup complete.
```

### 4. Criar usuários de teste
```bash
docker exec ConsultContabil-api python -m scripts.seed_users
```

### 5. Acessar aplicação

- **API**: http://localhost:8000
- **Documentação (Swagger)**: http://localhost:8000/docs
- **Frontend**: http://localhost:3000 (quando rodando)

### 6. Testar login

**Credenciais de teste**:
- Email: `admin@contabil.com`
- Senha: `admin123`

## Comandos do Dia a Dia

### Iniciar ambiente
```bash
docker compose up -d
```

### Parar ambiente
```bash
docker compose down
```

### Ver logs
```bash
# API
docker logs -f ConsultContabil-api

# PostgreSQL
docker logs -f ConsultContabil-postgres
```

### Reiniciar API (após mudanças)
```bash
docker compose restart api
```

### Executar migrações
```bash
docker exec ConsultContabil-api alembic upgrade head
```

### Acessar banco de dados
```bash
docker exec -it ConsultContabil-postgres psql -U contabil -d contabil_db
```

### Executar testes
```bash
docker exec ConsultContabil-api pytest
```

## Estrutura do Projeto

```
ContabilConsult/
├── apps/
│   ├── api/                 # Backend FastAPI
│   │   ├── alembic/        # Migrações
│   │   ├── app/            # Código da API
│   │   ├── scripts/        # Scripts utilitários
│   │   ├── tests/          # Testes
│   │   ├── Dockerfile      # Build da API
│   │   └── pyproject.toml  # Dependências
│   └── web/                # Frontend Next.js
├── docs/                   # Documentação
│   ├── DOCKER-SETUP.md
│   ├── PROBLEMAS-RESOLVIDOS.md
│   └── QUICK-START.md
├── docker-compose.yml      # Orquestração
└── README.md
```

## URLs Importantes

- **API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **API Docs (ReDoc)**: http://localhost:8000/redoc
- **API Health**: http://localhost:8000/api/v1/health

## Usuários de Teste

| Email | Senha | Role | Descrição |
|-------|-------|------|-----------|
| admin@contabil.com | admin123 | admin | Administrador do sistema |
| func@contabil.com | func123 | func | Funcionário da contabilidade |
| cliente@empresa.com | cliente123 | cliente | Cliente da contabilidade |

## Troubleshooting Rápido

### API não inicia
```bash
# Ver logs
docker logs ConsultContabil-api

# Reconstruir
docker compose up -d --build
```

### Login não funciona
```bash
# Recriar usuários
docker exec ConsultContabil-api python -m scripts.seed_users
```

### Porta em uso
```bash
# Verificar processos usando porta 8000
netstat -ano | findstr :8000

# Mudar porta no docker-compose.yml
ports:
  - "8001:8000"  # Usar 8001 ao invés de 8000
```

### Container PostgreSQL não sobe
```bash
# Verificar se porta 5432 está livre
netstat -ano | findstr :5432

# Parar outros PostgreSQL
docker stop <container-id>
```

### Resetar ambiente completamente
```bash
# CUIDADO: Isso deleta TODOS os dados
docker compose down -v
docker compose up -d --build
docker exec ConsultContabil-api python -m scripts.seed_users
```

## Desenvolvimento

### Hot Reload
A API possui hot-reload ativado. Mudanças no código são detectadas automaticamente.

### Adicionar nova dependência
```bash
# Editar apps/api/pyproject.toml
# Adicionar dependência na seção [dependencies]

# Reconstruir container
docker compose up -d --build
```

### Criar migração
```bash
docker exec ConsultContabil-api alembic revision --autogenerate -m "descrição"
```

### Aplicar migração
```bash
docker exec ConsultContabil-api alembic upgrade head
```

### Reverter migração
```bash
docker exec ConsultContabil-api alembic downgrade -1
```

## Próximos Passos

1. Explorar a documentação em `/docs`
2. Testar endpoints na Swagger UI
3. Verificar código em `apps/api/app`
4. Ler PRD em `docs/PRD.md`

## Suporte

- **Documentação completa**: Ver pasta `/docs`
- **Problemas conhecidos**: `docs/PROBLEMAS-RESOLVIDOS.md`
- **Configuração Docker**: `docs/DOCKER-SETUP.md`
