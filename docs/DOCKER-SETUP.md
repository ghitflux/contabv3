# Configuração Docker - ContabilConsult

## Visão Geral

O projeto utiliza Docker Compose para orquestrar os containers da aplicação, garantindo um ambiente de desenvolvimento consistente e isolado.

## Estrutura de Containers

### ConsultContabil-postgres
- **Imagem**: postgres:15
- **Porta**: 5432:5432
- **Credenciais**:
  - Usuário: `contabil`
  - Senha: `contabil123`
  - Database: `contabil_db`
- **Volume**: `consultcontabil_postgres_data`
- **Network**: `consultcontabil-network`
- **Healthcheck**: Verificação a cada 10s com `pg_isready`

### ConsultContabil-api
- **Build**: `./apps/api/Dockerfile`
- **Porta**: 8000:8000
- **Volumes**:
  - `./apps/api:/app` (código fonte com hot-reload)
  - `consultcontabil_api_uploads:/app/uploads` (arquivos enviados)
- **Network**: `consultcontabil-network`
- **Dependências**: Aguarda PostgreSQL estar healthy antes de iniciar
- **Comando**: Executa migrações + inicia servidor com reload

## Arquivos de Configuração

### docker-compose.yml
Localização: `./docker-compose.yml`

```yaml
services:
  postgres:
    # PostgreSQL 15 com healthcheck
  api:
    # API FastAPI com hot-reload
```

### Dockerfile (API)
Localização: `./apps/api/Dockerfile`

**Estágios**:
1. **base**: Instalação de dependências do sistema e Python
2. **development**: Hot-reload habilitado
3. **production**: Otimizado para produção

**Dependências instaladas**:
- gcc (compilação de pacotes Python)
- postgresql-client (para migrações)
- Todas as dependências do `pyproject.toml`

## Comandos Úteis

### Iniciar ambiente
```bash
docker compose up -d
```

### Reconstruir e iniciar
```bash
docker compose up -d --build
```

### Parar containers
```bash
docker compose down
```

### Ver logs
```bash
# Logs da API
docker logs -f ConsultContabil-api

# Logs do PostgreSQL
docker logs -f ConsultContabil-postgres
```

### Executar comandos no container
```bash
# Shell na API
docker exec -it ConsultContabil-api bash

# Shell no PostgreSQL
docker exec -it ConsultContabil-postgres psql -U contabil -d contabil_db

# Executar migrações
docker exec ConsultContabil-api alembic upgrade head

# Criar usuários de teste
docker exec ConsultContabil-api python -m scripts.seed_users
```

### Verificar status
```bash
docker ps
docker compose ps
```

## Fluxo de Inicialização

1. Docker Compose cria network `consultcontabil-network`
2. Docker Compose cria volumes necessários
3. Container PostgreSQL inicia
4. Healthcheck aguarda PostgreSQL estar pronto
5. Container API inicia
6. Alembic executa migrações pendentes
7. Uvicorn inicia servidor com hot-reload

## Variáveis de Ambiente (API)

```env
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://contabil:contabil123@postgres:5432/contabil_db
SECRET_KEY=dev-secret-key-change-in-production-12345678
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000,http://localhost
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=/app/uploads
```

## Troubleshooting

### API não conecta ao banco
**Problema**: `password authentication failed for user "contabil"`

**Solução**:
- Verificar se PostgreSQL está healthy: `docker ps`
- Verificar logs do PostgreSQL: `docker logs ConsultContabil-postgres`
- Recriar containers: `docker compose down && docker compose up -d --build`

### Migrações não executam
**Problema**: `cannot import name 'X' from 'app.db.models'`

**Solução**:
- Verificar importações em `apps/api/app/db/models/__init__.py`
- Garantir que todos os modelos estão importados corretamente
- Verificar imports circulares

### Container reinicia constantemente
**Problema**: Container API reinicia em loop

**Solução**:
- Verificar logs: `docker logs ConsultContabil-api`
- Verificar se todas as dependências estão instaladas em `pyproject.toml`
- Reconstruir imagem: `docker compose up -d --build`

### Hot-reload não funciona
**Problema**: Mudanças no código não são detectadas

**Solução**:
- Verificar se volume está montado: `docker inspect ConsultContabil-api`
- Verificar permissões de arquivo
- Reiniciar container: `docker compose restart api`

## Usuários de Teste

Após executar `docker exec ConsultContabil-api python -m scripts.seed_users`:

| Email | Senha | Role |
|-------|-------|------|
| admin@contabil.com | admin123 | admin |
| func@contabil.com | func123 | func |
| cliente@empresa.com | cliente123 | cliente |

## Portas Utilizadas

- **8000**: API FastAPI
- **5432**: PostgreSQL
- **3000**: Frontend (quando rodando)

## Boas Práticas

1. **Sempre usar docker-compose** ao invés de `docker run` manual
2. **Nomear containers** com prefixo do projeto (ConsultContabil-)
3. **Usar healthchecks** para dependências críticas (PostgreSQL)
4. **Versionar volumes** com nome do projeto
5. **Não commitar .env** com credenciais reais
6. **Usar multi-stage builds** para otimizar imagens
7. **Hot-reload apenas em desenvolvimento**

## Produção

Para produção, alterar:

1. **Dockerfile**: usar stage `production`
2. **Variáveis de ambiente**:
   - `DEBUG=false`
   - `SECRET_KEY`: chave aleatória segura
   - Credenciais seguras do banco
3. **Volumes**: não montar código fonte
4. **Comando**: sem `--reload` no uvicorn
5. **Usar orquestrador**: Kubernetes, Docker Swarm, etc.
