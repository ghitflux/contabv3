# Deploy Ambiente de Testes - Ubuntu VPS Hostinger

**Domínio**: testecic.ghitflux.com
**IP VPS**: 72.60.58.181
**SO**: Ubuntu (VPS Hostinger)
**Fluxo**: GitHub → Docker (servidor)
**Objetivo**: Ambiente de testes simplificado para usuários

---

## 0. Pré-requisitos

### No seu computador local
- Git configurado
- Acesso SSH ao servidor
- Repositório no GitHub atualizado

### Informações necessárias
- **IP do VPS**: 72.60.58.181
- **Usuário SSH**: (geralmente `root` ou `ubuntu`)
- **Senha/Chave SSH**: fornecida pela Hostinger
- **Repositório GitHub**: URL do repo ContabilConsult

---

## 1. Configuração DNS (Cloudflare)

1. Acesse o painel da Cloudflare
2. Entre no domínio `ghitflux.com`
3. Crie/atualize o registro **A**:
   - **Name**: `testecic`
   - **IPv4**: `72.60.58.181`
   - **Proxy status**: **DNS only** (nuvem cinza)
   - **TTL**: Auto
4. Salve e aguarde propagação (1-5 minutos)

> Após SSL configurado, pode ativar proxy (nuvem laranja) se desejar WAF/Cache da Cloudflare.

---

## 2. Conectar ao servidor via SSH

```bash
# Conectar ao VPS (ajuste o usuário conforme necessário)
ssh root@72.60.58.181

# OU se usar usuário ubuntu
ssh ubuntu@72.60.58.181
```

> Se usar chave SSH: `ssh -i caminho/para/chave.pem root@72.60.58.181`

---

## 3. Atualizar sistema e instalar dependências

```bash
# Atualizar pacotes
apt update && apt upgrade -y

# Instalar dependências essenciais
apt install -y git curl wget ufw nginx certbot python3-certbot-nginx

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Instalar Docker Compose (plugin)
apt install -y docker-compose-plugin

# Verificar instalação
docker --version
docker compose version
nginx -v
```

---

## 4. Configurar Firewall (UFW)

```bash
# Regras básicas
ufw default deny incoming
ufw default allow outgoing

# Permitir SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Ativar firewall
ufw enable

# Verificar status
ufw status verbose
```

---

## 5. Criar estrutura de diretórios

```bash
# Criar diretório do projeto
mkdir -p /opt/contabilconsult
cd /opt/contabilconsult
```

---

## 6. Clonar repositório do GitHub

```bash
cd /opt/contabilconsult

# Clonar (substitua pela URL do seu repo)
git clone https://github.com/SEU_USUARIO/ContabilConsult.git .

# OU se já tiver clonado, apenas atualizar
git pull origin main

# Verificar branch
git branch
```

> **Importante**: Se o repositório for privado, configure SSH keys ou use token de acesso pessoal.

---

## 7. Criar arquivo de ambiente de produção

```bash
# Criar arquivo .env.prod
nano /opt/contabilconsult/.env.prod
```

### Conteúdo do `.env.prod`:

```bash
# Environment
ENVIRONMENT=production
DEBUG=false

# Database
DATABASE_URL=postgresql+asyncpg://contabil:SENHA_FORTE_AQUI@postgres:5432/contabil_db
DATABASE_WRITE_URL=postgresql+asyncpg://contabil:SENHA_FORTE_AQUI@postgres:5432/contabil_db
DATABASE_READ_URL=postgresql+asyncpg://contabil:SENHA_FORTE_AQUI@postgres:5432/contabil_db

POSTGRES_USER=contabil
POSTGRES_PASSWORD=SENHA_FORTE_AQUI
POSTGRES_DB=contabil_db
POSTGRES_PORT=5432

# Security (gerar chaves fortes)
SECRET_KEY=CHAVE_SECRETA_FORTE_AQUI
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=https://testecic.ghitflux.com

# Upload
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=/var/uploads

# Frontend
NEXT_PUBLIC_API_URL=https://testecic.ghitflux.com
NEXT_PUBLIC_APP_NAME=Contabil Consult - Teste
NEXT_PUBLIC_APP_URL=https://testecic.ghitflux.com
```

### Gerar chaves secretas fortes:

```bash
# Gerar SECRET_KEY
openssl rand -hex 32

# Gerar POSTGRES_PASSWORD
openssl rand -base64 24
```

> **Copie as chaves geradas** e cole no `.env.prod` nos campos correspondentes.

**Salvar**: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 8. Criar Dockerfile para produção (Web)

```bash
# Criar diretório para Dockerfiles
mkdir -p /opt/contabilconsult/infra/docker

# Criar Dockerfile para frontend
nano /opt/contabilconsult/infra/docker/Dockerfile.web.prod
```

### Conteúdo do `Dockerfile.web.prod`:

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@8.15.0

# Dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/ 2>/dev/null || true

RUN pnpm install --frozen-lockfile

# Build
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter web build

# Runner
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g pnpm@8.15.0

COPY --from=base /app /app

EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
```

**Salvar**: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 9. Criar docker-compose de produção

```bash
nano /opt/contabilconsult/docker-compose.prod.yml
```

### Conteúdo do `docker-compose.prod.yml`:

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

**Salvar**: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 10. Build e deploy dos containers

```bash
cd /opt/contabilconsult

# Carregar variáveis de ambiente
set -a
source .env.prod
set +a

# Build e iniciar containers
docker compose -f docker-compose.prod.yml up -d --build

# Verificar status
docker compose -f docker-compose.prod.yml ps

# Verificar logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

### Testar localmente no servidor:

```bash
# Testar API
curl -f http://127.0.0.1:8000/api/v1/health

# Testar Web
curl -I http://127.0.0.1:3000
```

Se retornar `200 OK`, está funcionando! ✅

---

## 11. Configurar Nginx como Reverse Proxy

```bash
# Criar configuração do site
nano /etc/nginx/sites-available/testecic.ghitflux.com
```

### Conteúdo do arquivo Nginx:

```nginx
# HTTP (redirecionará para HTTPS após SSL)
server {
    listen 80;
    listen [::]:80;
    server_name testecic.ghitflux.com;

    # Redirecionar para HTTPS (será configurado após certbot)
    # return 301 https://$server_name$request_uri;

    # Por enquanto, configurar proxy HTTP
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    client_max_body_size 10M;
}
```

**Salvar**: `Ctrl+O`, `Enter`, `Ctrl+X`

### Ativar o site:

```bash
# Criar link simbólico
ln -s /etc/nginx/sites-available/testecic.ghitflux.com /etc/nginx/sites-enabled/

# Remover configuração padrão (opcional)
rm /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl status nginx
```

---

## 12. Configurar SSL com Let's Encrypt

```bash
# Certbot configurará SSL automaticamente
certbot --nginx -d testecic.ghitflux.com

# Responder às perguntas:
# - Email: seu@email.com
# - Aceitar termos: Y
# - Compartilhar email: Y ou N
# - Redirecionar HTTP para HTTPS: 2 (sim)

# Verificar renovação automática
certbot renew --dry-run
```

### Após SSL configurado:

```bash
# Testar HTTPS
curl -I https://testecic.ghitflux.com

# Testar API
curl -f https://testecic.ghitflux.com/api/v1/health
```

✅ Deve retornar `200 OK` com certificado válido!

---

## 13. Scripts de automação

### 13.1. Script de Deploy/Atualização

```bash
# Criar script de deploy
nano /opt/contabilconsult/deploy.sh
```

**Conteúdo**:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Iniciando deploy..."

cd /opt/contabilconsult

# 1. Backup do banco
echo "📦 Fazendo backup do banco..."
docker exec -t contabil-postgres-prod pg_dump -U contabil -F c -d contabil_db > backup_$(date +%F_%H-%M).dump

# 2. Atualizar código
echo "📥 Atualizando código do GitHub..."
git fetch --all
git pull origin main

# 3. Carregar variáveis
echo "🔧 Carregando variáveis de ambiente..."
set -a
source .env.prod
set +a

# 4. Rebuild e restart
echo "🐳 Rebuild e restart dos containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verificar saúde
echo "🏥 Verificando saúde dos serviços..."
sleep 10
docker compose -f docker-compose.prod.yml ps

# 6. Testar API
echo "🧪 Testando API..."
curl -f http://127.0.0.1:8000/api/v1/health || echo "❌ API health check falhou!"

echo "✅ Deploy concluído!"
echo "📊 Logs da API: docker compose -f docker-compose.prod.yml logs -f api"
```

**Tornar executável**:

```bash
chmod +x /opt/contabilconsult/deploy.sh
```

### 13.2. Script de Backup

```bash
# Criar diretório de backups
mkdir -p /opt/contabilconsult/backups

# Criar script
nano /opt/contabilconsult/backup.sh
```

**Conteúdo**:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/contabilconsult/backups"
TIMESTAMP=$(date +%F_%H-%M)

echo "📦 Iniciando backup..."

# Backup do banco
docker exec -t contabil-postgres-prod pg_dump -U contabil -F c -d contabil_db \
  > "$BACKUP_DIR/contabil_db_$TIMESTAMP.dump"

gzip -9 "$BACKUP_DIR/contabil_db_$TIMESTAMP.dump"

# Backup de uploads
docker run --rm \
  -v contabil_api_uploads:/data \
  -v "$BACKUP_DIR":/backup \
  alpine:3.20 \
  sh -c "tar -czf /backup/uploads_$TIMESTAMP.tar.gz -C /data ."

# Limpar backups antigos (manter últimos 7 dias)
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "✅ Backup concluído: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

**Tornar executável**:

```bash
chmod +x /opt/contabilconsult/backup.sh
```

### 13.3. Agendar backups automáticos

```bash
# Editar crontab
crontab -e
```

**Adicionar linha** (backup diário às 3h):

```cron
0 3 * * * cd /opt/contabilconsult && /opt/contabilconsult/backup.sh >> /var/log/contabil_backup.log 2>&1
```

---

## 14. Comandos úteis para gerenciamento

### Ver logs em tempo real:

```bash
cd /opt/contabilconsult

# Logs da API
docker compose -f docker-compose.prod.yml logs -f api

# Logs do Web
docker compose -f docker-compose.prod.yml logs -f web

# Logs do Postgres
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Reiniciar serviços:

```bash
cd /opt/contabilconsult

# Reiniciar tudo
docker compose -f docker-compose.prod.yml restart

# Reiniciar apenas API
docker compose -f docker-compose.prod.yml restart api

# Reiniciar apenas Web
docker compose -f docker-compose.prod.yml restart web
```

### Parar/Iniciar containers:

```bash
cd /opt/contabilconsult

# Parar tudo
docker compose -f docker-compose.prod.yml down

# Iniciar tudo
docker compose -f docker-compose.prod.yml up -d

# Ver status
docker compose -f docker-compose.prod.yml ps
```

### Atualizar aplicação:

```bash
cd /opt/contabilconsult

# Usar script de deploy
./deploy.sh

# OU manualmente:
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Acessar shell dos containers:

```bash
# Shell da API (Python)
docker exec -it contabil-api-prod sh

# Shell do Postgres
docker exec -it contabil-postgres-prod psql -U contabil -d contabil_db

# Shell do Web (Node)
docker exec -it contabil-web-prod sh
```

### Verificar uso de recursos:

```bash
# CPU e memória dos containers
docker stats

# Espaço em disco
df -h
docker system df
```

---

## 15. Checklist de validação

Após deploy, verificar:

- [ ] DNS propagado: `nslookup testecic.ghitflux.com` → `72.60.58.181`
- [ ] HTTPS ativo: `https://testecic.ghitflux.com` abre o site
- [ ] Certificado SSL válido (cadeado verde no navegador)
- [ ] API respondendo: `https://testecic.ghitflux.com/api/v1/health` → `200 OK`
- [ ] Containers rodando: `docker compose ps` → todos "Up"
- [ ] Logs sem erros críticos
- [ ] Firewall configurado: `ufw status` → ativo
- [ ] Backup agendado: `crontab -l` → cron configurado
- [ ] Login funcionando (testar no navegador)
- [ ] Upload de arquivos funcionando

---

## 16. Troubleshooting

### Problema: DNS não resolve

```bash
# Verificar DNS
nslookup testecic.ghitflux.com

# Aguardar propagação (até 1 hora)
# Limpar cache DNS local (no seu computador)
```

### Problema: Containers não sobem

```bash
# Ver logs detalhados
docker compose -f docker-compose.prod.yml logs

# Verificar se portas estão em uso
netstat -tulpn | grep -E ':(3000|8000|5432)'

# Parar tudo e tentar novamente
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Problema: API retorna 502 Bad Gateway

```bash
# Verificar se API está rodando
curl http://127.0.0.1:8000/api/v1/health

# Ver logs da API
docker compose -f docker-compose.prod.yml logs api

# Reiniciar API
docker compose -f docker-compose.prod.yml restart api
```

### Problema: SSL não funciona

```bash
# Verificar certificado
certbot certificates

# Renovar manualmente
certbot renew --force-renewal

# Verificar configuração Nginx
nginx -t
systemctl restart nginx
```

### Problema: Banco de dados corrompido

```bash
# Restaurar do backup
cd /opt/contabilconsult/backups

# Descompactar backup
gunzip contabil_db_YYYY-MM-DD_HH-MM.dump.gz

# Restaurar (CUIDADO: sobrescreve dados!)
docker exec -i contabil-postgres-prod pg_restore -U contabil -d contabil_db -c < contabil_db_YYYY-MM-DD_HH-MM.dump
```

---

## 17. Atualizações futuras

### Atualizar para nova versão:

```bash
# 1. Conectar ao servidor
ssh root@72.60.58.181

# 2. Executar script de deploy
cd /opt/contabilconsult
./deploy.sh

# 3. Verificar logs
docker compose -f docker-compose.prod.yml logs -f
```

### Rollback em caso de erro:

```bash
cd /opt/contabilconsult

# Ver commits
git log --oneline -10

# Voltar para commit anterior
git checkout HASH_DO_COMMIT_ANTERIOR

# Rebuild
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 18. Monitoramento básico

### Criar script de health check:

```bash
nano /opt/contabilconsult/healthcheck.sh
```

**Conteúdo**:

```bash
#!/usr/bin/env bash

API_URL="https://testecic.ghitflux.com/api/v1/health"
WEB_URL="https://testecic.ghitflux.com"

echo "🏥 Health Check - $(date)"
echo "========================================"

# Testar API
if curl -f -s "$API_URL" > /dev/null; then
    echo "✅ API: OK"
else
    echo "❌ API: FALHOU"
fi

# Testar Web
if curl -f -s -I "$WEB_URL" > /dev/null; then
    echo "✅ WEB: OK"
else
    echo "❌ WEB: FALHOU"
fi

# Status dos containers
echo ""
echo "📦 Containers:"
docker compose -f /opt/contabilconsult/docker-compose.prod.yml ps

# Uso de recursos
echo ""
echo "💾 Uso de disco:"
df -h / | tail -1
```

**Tornar executável**:

```bash
chmod +x /opt/contabilconsult/healthcheck.sh
```

**Agendar verificação** (a cada 30 minutos):

```bash
crontab -e
```

Adicionar:

```cron
*/30 * * * * /opt/contabilconsult/healthcheck.sh >> /var/log/contabil_healthcheck.log 2>&1
```

---

## 19. Segurança adicional (opcional)

### Fail2ban para proteger SSH:

```bash
apt install -y fail2ban

# Configurar
nano /etc/fail2ban/jail.local
```

Adicionar:

```ini
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
```

Reiniciar:

```bash
systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status
```

### Atualizar sistema regularmente:

```bash
# Adicionar ao crontab
crontab -e
```

Adicionar (atualização semanal aos domingos 4h):

```cron
0 4 * * 0 apt update && apt upgrade -y && apt autoremove -y
```

---

## 20. Acesso para desenvolvedores

### Criar usuário não-root para deploy:

```bash
# Criar usuário
adduser deploy

# Adicionar ao grupo docker
usermod -aG docker deploy

# Copiar chaves SSH (do root)
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Dar permissões no diretório do projeto
chown -R deploy:deploy /opt/contabilconsult
```

Agora pode conectar com:

```bash
ssh deploy@72.60.58.181
```

---

## Resumo dos comandos principais

```bash
# Conectar ao servidor
ssh root@72.60.58.181

# Atualizar aplicação
cd /opt/contabilconsult && ./deploy.sh

# Ver logs
docker compose -f docker-compose.prod.yml logs -f api

# Reiniciar serviços
docker compose -f docker-compose.prod.yml restart

# Fazer backup manual
/opt/contabilconsult/backup.sh

# Health check
/opt/contabilconsult/healthcheck.sh

# Ver status
docker compose -f docker-compose.prod.yml ps
```

---

## Próximos passos

1. **Configurar CI/CD** (GitHub Actions para deploy automático)
2. **Monitoramento avançado** (Prometheus + Grafana)
3. **Backups em nuvem** (AWS S3, Backblaze, etc.)
4. **Testes automatizados** antes do deploy
5. **Rate limiting** no Nginx
6. **CDN** para assets estáticos

---

**Ambiente**: Testes
**Última atualização**: 2026-01-05
**Contato**: Equipe de desenvolvimento
