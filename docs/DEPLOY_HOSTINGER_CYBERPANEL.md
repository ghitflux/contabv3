# Deploy completo via CyberPanel (Hostinger VPS) - testecic.ghitflux.com

Este guia foi feito para executar **tudo pelo CyberPanel**, usando apenas o painel e o **Terminal interno** do CyberPanel (sem SSH externo). Inclui: criacao de subdominio, DNS na Cloudflare, Docker, reverse proxy, SSL, Fail2ban, protecao contra malware e protocolos de atualizacao/backup/correcao.

## 0) Criar o subdominio no CyberPanel (primeiro passo)

1) Acesse o CyberPanel: `https://IP_DO_VPS:8090`
2) Menu: **Websites -> Create Website**
3) Preencha:
   - Domain: `testecic.ghitflux.com`
   - Email: `admin@seudominio.com`
   - Package: selecione o pacote desejado
4) Clique em **Create Website**
5) Aguarde o site ser criado

> Se o dominio principal ja existe e voce quer criar um subdominio, use **Websites -> Create Child Domain** e informe `testecic.ghitflux.com` como Child Domain.

## 1) Criar o DNS no Cloudflare

1) Abra o painel da Cloudflare
2) Entre no dominio `ghitflux.com`
3) Crie um registro **A**:
   - Name: `testecic`
   - IPv4: IP do VPS
   - Proxy status: **DNS only** (nuvem cinza) inicialmente
4) Aguarde a propagacao

> Depois do SSL emitido no CyberPanel, voce pode trocar para **proxied** (nuvem laranja) se quiser usar o WAF/Cache da Cloudflare. Habilite WebSockets na Cloudflare se usar o proxy.

## 2) Abrir o Terminal interno do CyberPanel

Todos os comandos abaixo devem ser executados no **Terminal do CyberPanel**:

- Menu: **Server -> Terminal**

## 3) Atualizar sistema e instalar dependencias

```bash
apt update && apt -y upgrade
apt -y install git curl ufw fail2ban
```

## 4) Instalar Docker (via Terminal do CyberPanel)

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

## 5) Estrutura do projeto no servidor

Sugestao de caminho dentro do servidor:

```
/home/testecic.ghitflux.com/contabilconsult
```

### 5.1 Clonar o repositorio (via Terminal)

```bash
mkdir -p /home/testecic.ghitflux.com/contabilconsult
cd /home/testecic.ghitflux.com/contabilconsult

# Clone
git clone REPO_URL .

git checkout BRANCH
```

> Se preferir usar a interface do CyberPanel, use **Git Manager** e clone no caminho acima.

## 6) Criar arquivo de ambiente de producao

Crie `/home/testecic.ghitflux.com/contabilconsult/.env.prod`:

```bash
nano /home/testecic.ghitflux.com/contabilconsult/.env.prod
```

Exemplo (ajuste valores):

```
# Backend
ENVIRONMENT=production
DEBUG=false

DATABASE_URL=postgresql+asyncpg://contabil:STRONG_DB_PASSWORD@postgres:5432/contabil_db
DATABASE_WRITE_URL=postgresql+asyncpg://contabil:STRONG_DB_PASSWORD@postgres:5432/contabil_db
DATABASE_READ_URL=postgresql+asyncpg://contabil:STRONG_DB_PASSWORD@postgres:5432/contabil_db

SECRET_KEY=COLOQUE_UMA_CHAVE_FORTE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=https://testecic.ghitflux.com

MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=/var/uploads

# Frontend
NEXT_PUBLIC_API_URL=https://testecic.ghitflux.com
NEXT_PUBLIC_APP_NAME=SaaS Contabil
NEXT_PUBLIC_APP_URL=https://testecic.ghitflux.com

# Database
POSTGRES_USER=contabil
POSTGRES_PASSWORD=STRONG_DB_PASSWORD
POSTGRES_DB=contabil_db
POSTGRES_PORT=5432
```

Gere chaves fortes:

```bash
openssl rand -hex 32
```

## 7) Criar Dockerfile web de producao

Crie `infra/docker/Dockerfile.web.prod`:

```bash
nano /home/testecic.ghitflux.com/contabilconsult/infra/docker/Dockerfile.web.prod
```

Conteudo:

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@8.15.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter web build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g pnpm@8.15.0

COPY --from=base /app /app

EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
```

## 8) Criar docker-compose de producao

Crie `/home/testecic.ghitflux.com/contabilconsult/docker-compose.prod.yml`:

```bash
nano /home/testecic.ghitflux.com/contabilconsult/docker-compose.prod.yml
```

Conteudo:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: contabil-postgres-prod
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - contabil_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - contabil-network
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: production
    container_name: contabil-api-prod
    env_file:
      - .env.prod
    environment:
      API_HOST: 0.0.0.0
      API_PORT: 8000
      LOG_LEVEL: INFO
    command: >-
      sh -c "alembic upgrade head && uvicorn app.main:app
      --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - contabil_api_uploads:/var/uploads
    ports:
      - "127.0.0.1:8000:8000"
    networks:
      - contabil-network
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: infra/docker/Dockerfile.web.prod
      args:
        NEXT_PUBLIC_API_URL: https://testecic.ghitflux.com
    container_name: contabil-web-prod
    env_file:
      - .env.prod
    environment:
      NODE_ENV: production
    depends_on:
      - api
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - contabil-network
    restart: unless-stopped

volumes:
  contabil_postgres_data:
  contabil_api_uploads:

networks:
  contabil-network:
    driver: bridge
```

## 9) Subir os containers

```bash
cd /home/testecic.ghitflux.com/contabilconsult

set -a
source .env.prod
set +a

docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps
```

Teste local:

```bash
curl -f http://127.0.0.1:8000/api/v1/health
curl -I http://127.0.0.1:3000
```

## 10) SSL no CyberPanel (Let's Encrypt)

1) Menu: **Websites -> List Websites -> testecic.ghitflux.com**
2) Clique em **Issue SSL**
3) Aguarde a emissao

> Lembre-se: o DNS deve estar propagado e como **DNS only** na Cloudflare para o desafio HTTP.

## 11) Reverse proxy no OpenLiteSpeed (CyberPanel)

1) Menu: **Websites -> List Websites -> testecic.ghitflux.com**
2) Abra **vHost Conf**
3) Edite e adicione os blocos abaixo

```
extprocessor app_web {
  type                    proxy
  address                 127.0.0.1:3000
  maxConns                1000
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

extprocessor app_api {
  type                    proxy
  address                 127.0.0.1:8000
  maxConns                1000
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 app_web
  addDefaultCharset       off
}

context /api/ {
  type                    proxy
  handler                 app_api
  addDefaultCharset       off
}

context /api/v1/ {
  type                    proxy
  handler                 app_api
  addDefaultCharset       off
}

context /api/v1/ws/ {
  type                    proxy
  handler                 app_api
  addDefaultCharset       off
}
```

4) Salve e **reinicie o OLS** (botao Restart LSWS no CyberPanel)

Teste externo:

```bash
curl -I https://testecic.ghitflux.com
curl -f https://testecic.ghitflux.com/api/v1/health
```

## 12) Firewall e Fail2ban (via Terminal do CyberPanel)

### 12.1 Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from SEU_IP_ADMIN to any port 8090 proto tcp
ufw allow from SEU_IP_ADMIN to any port 7080 proto tcp
ufw enable
ufw status verbose
```

### 12.2 Fail2ban

Crie `/etc/fail2ban/filter.d/openlitespeed.conf`:

```
[Definition]
failregex = ^<HOST> - .*"(GET|POST|HEAD).*" (403|404|429|500) .*$
ignoreregex =
```

Crie `/etc/fail2ban/jail.local`:

```
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 12h

[openlitespeed]
enabled = true
port = http,https
filter = openlitespeed
logpath = /home/*/logs/access.log
maxretry = 15
findtime = 10m
bantime = 12h
```

Reinicie:

```bash
systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status
```

## 13) Protecao contra malware (ClamAV)

```bash
apt -y install clamav clamav-daemon
systemctl stop clamav-freshclam
freshclam
systemctl start clamav-freshclam
```

Script de varredura de uploads:

```bash
mkdir -p /home/testecic.ghitflux.com/contabilconsult/ops /home/testecic.ghitflux.com/contabilconsult/quarantine
nano /home/testecic.ghitflux.com/contabilconsult/ops/scan_uploads.sh
```

Conteudo:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCAN_DIR="/var/lib/docker/volumes/contabil_api_uploads/_data"
QUAR_DIR="/home/testecic.ghitflux.com/contabilconsult/quarantine"
mkdir -p "$QUAR_DIR"
clamscan -r --infected --move="$QUAR_DIR" "$SCAN_DIR"
```

```bash
chmod +x /home/testecic.ghitflux.com/contabilconsult/ops/scan_uploads.sh
```

Agendar no cron:

```bash
crontab -e
```

Adicionar:

```
0 3 * * * /home/testecic.ghitflux.com/contabilconsult/ops/scan_uploads.sh >> /var/log/clamav/scan_uploads.log 2>&1
```

## 14) Protocolos operacionais (via Terminal do CyberPanel)

### 14.1 Protocolo de atualizacao

1) Abrir janela de manutencao
2) Backup completo (DB + uploads)
3) Atualizar codigo e imagens

```bash
cd /home/testecic.ghitflux.com/contabilconsult

git fetch --all
# opcional: git checkout vX.Y.Z
# ou:
git checkout BRANCH
git pull

set -a
source .env.prod
set +a

docker compose -f docker-compose.prod.yml build --pull

docker compose -f docker-compose.prod.yml up -d
```

Validar:

```bash
curl -f https://testecic.ghitflux.com/api/v1/health

docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### 14.2 Protocolo de backup

#### Backup do banco

Crie `/home/testecic.ghitflux.com/contabilconsult/ops/backup_db.sh`:

```bash
nano /home/testecic.ghitflux.com/contabilconsult/ops/backup_db.sh
```

Conteudo:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/home/testecic.ghitflux.com/contabilconsult/backups/db"
mkdir -p "$BACKUP_DIR"
TS=$(date +%F_%H-%M)

docker exec -t contabil-postgres-prod pg_dump -U "$POSTGRES_USER" -F c -d "$POSTGRES_DB" \
  > "$BACKUP_DIR/contabil_db_$TS.dump"

gzip -9 "$BACKUP_DIR/contabil_db_$TS.dump"

find "$BACKUP_DIR" -type f -mtime +14 -delete
```

```bash
chmod +x /home/testecic.ghitflux.com/contabilconsult/ops/backup_db.sh
```

#### Backup de uploads

Crie `/home/testecic.ghitflux.com/contabilconsult/ops/backup_uploads.sh`:

```bash
nano /home/testecic.ghitflux.com/contabilconsult/ops/backup_uploads.sh
```

Conteudo:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/home/testecic.ghitflux.com/contabilconsult/backups/uploads"
mkdir -p "$BACKUP_DIR"
TS=$(date +%F_%H-%M)

docker run --rm \
  -v contabil_api_uploads:/data \
  -v "$BACKUP_DIR":/backup \
  alpine:3.20 \
  sh -c "tar -czf /backup/uploads_$TS.tar.gz -C /data ."

find "$BACKUP_DIR" -type f -mtime +14 -delete
```

```bash
chmod +x /home/testecic.ghitflux.com/contabilconsult/ops/backup_uploads.sh
```

#### Agendamento

```bash
crontab -e
```

Adicionar:

```
0 2 * * * cd /home/testecic.ghitflux.com/contabilconsult && set -a && source .env.prod && set +a && /home/testecic.ghitflux.com/contabilconsult/ops/backup_db.sh >> /var/log/backup_db.log 2>&1
30 2 * * * /home/testecic.ghitflux.com/contabilconsult/ops/backup_uploads.sh >> /var/log/backup_uploads.log 2>&1
```

### 14.3 Protocolo de correcao (hotfix)

```bash
cd /home/testecic.ghitflux.com/contabilconsult

git checkout COMMIT_ANTERIOR

docker compose -f docker-compose.prod.yml up -d --build
```

Se migracoes quebraram compatibilidade, restaure o backup do banco.

## 15) Checklist final

- HTTPS ativo e redirecionando HTTP
- /api/v1/health responde 200
- Containers ok: `docker compose ps`
- Fail2ban ativo e sem erros
- Backups agendados
- ClamAV varrendo uploads

## 16) Observacoes importantes

- O websocket no front usa query param, mas o backend espera token no path. Ajuste isso antes do go-live.
- Use o mesmo dominio para web e API, evitando CORS e simplificando proxy.
- Nao exponha a porta 5432 publicamente.

