# 🚀 Deploy Definitivo em Produção - Hostinger Ubuntu

**Versão**: 1.0
**Data**: 2026-01-07
**Ambiente**: Produção (Hostinger VPS)
**Sistema**: Ubuntu 22.04 LTS
**Containers**: Docker + Docker Compose

---

## 📋 Índice

1. [Preparação do VPS](#1-preparação-do-vps)
2. [Hardening de Segurança](#2-hardening-de-segurança)
3. [Instalação de Dependências](#3-instalação-de-dependências)
4. [Configuração de Firewall](#4-configuração-de-firewall)
5. [Fail2Ban - Proteção contra Brute Force](#5-fail2ban---proteção-contra-brute-force)
6. [Deploy da Aplicação](#6-deploy-da-aplicação)
7. [SSL e HTTPS](#7-ssl-e-https)
8. [Monitoramento e Logs](#8-monitoramento-e-logs)
9. [Backups Automatizados](#9-backups-automatizados)
10. [Atualização Automática](#10-atualização-automática)
11. [Proteção contra Malware](#11-proteção-contra-malware)
12. [Manutenção e Troubleshooting](#12-manutenção-e-troubleshooting)

---

## 1. Preparação do VPS

### 1.1. Informações do Servidor

```bash
# Anotar as informações do VPS
IP_SERVIDOR="SEU_IP_AQUI"
DOMINIO="contabil.seudominio.com"
USUARIO_DEPLOY="deploy"
```

### 1.2. Primeiro Acesso (como root)

```bash
# Conectar ao servidor
ssh root@$IP_SERVIDOR

# Atualizar sistema
apt update && apt upgrade -y

# Instalar utilitários básicos
apt install -y curl wget git vim nano htop net-tools ufw fail2ban
```

### 1.3. Criar Usuário de Deploy

```bash
# Criar usuário dedicado para deploy (NÃO usar root)
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Configurar chave SSH
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# Copiar chave SSH pública (do seu computador local)
# Execute no seu computador:
# cat ~/.ssh/id_rsa.pub | ssh root@$IP_SERVIDOR "cat >> /home/deploy/.ssh/authorized_keys"

# No servidor:
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### 1.4. Desabilitar Login Root via SSH

```bash
# Editar configuração SSH
nano /etc/ssh/sshd_config

# Modificar/adicionar estas linhas:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222  # Mudar porta SSH (opcional mas recomendado)
MaxAuthTries 3
MaxSessions 2

# Reiniciar SSH
systemctl restart sshd

# ⚠️ IMPORTANTE: Teste a conexão com novo usuário ANTES de desconectar root!
# Em outro terminal: ssh deploy@$IP_SERVIDOR -p 2222
```

---

## 2. Hardening de Segurança

### 2.1. Configurar Timezone e NTP

```bash
# Configurar timezone
timedatectl set-timezone America/Sao_Paulo

# Instalar e configurar NTP
apt install -y chrony
systemctl enable chrony
systemctl start chrony
```

### 2.2. Limitar Recursos por Processo

```bash
# Editar limites
nano /etc/security/limits.conf

# Adicionar no final:
* soft nofile 65535
* hard nofile 65535
* soft nproc 4096
* hard nproc 4096
root soft nofile 65535
root hard nofile 65535
```

### 2.3. Desabilitar Serviços Desnecessários

```bash
# Verificar serviços ativos
systemctl list-units --type=service --state=running

# Desabilitar serviços não necessários
systemctl disable bluetooth.service
systemctl disable cups.service
systemctl disable avahi-daemon.service

# Aplicar
systemctl daemon-reload
```

### 2.4. Configurar Auditd (Auditoria de Sistema)

```bash
# Instalar auditd
apt install -y auditd audispd-plugins

# Configurar regras de auditoria
cat > /etc/audit/rules.d/custom.rules << 'EOF'
# Monitorar modificações em arquivos críticos
-w /etc/passwd -p wa -k identity
-w /etc/group -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudoers
-w /etc/ssh/sshd_config -p wa -k sshd

# Monitorar execuções suspeitas
-w /usr/bin/curl -p x -k network_tools
-w /usr/bin/wget -p x -k network_tools
-w /usr/bin/nc -p x -k network_tools

# Monitorar modificações em Docker
-w /var/lib/docker -p wa -k docker
-w /etc/docker/daemon.json -p wa -k docker_config

# Monitorar criação de processos
-a exit,always -F arch=b64 -S execve -k exec
EOF

# Reiniciar auditd
systemctl restart auditd
systemctl enable auditd
```

---

## 3. Instalação de Dependências

### 3.1. Instalar Docker

```bash
# Remover versões antigas
apt remove -y docker docker-engine docker.io containerd runc

# Instalar dependências
apt update
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Adicionar chave GPG oficial do Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Adicionar repositório Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Adicionar usuário ao grupo docker
usermod -aG docker deploy

# Configurar Docker daemon
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "icc": false,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
EOF

# Reiniciar Docker
systemctl restart docker
systemctl enable docker

# Verificar instalação
docker --version
docker compose version
```

### 3.2. Instalar Nginx

```bash
# Instalar Nginx
apt install -y nginx

# Remover configuração padrão
rm /etc/nginx/sites-enabled/default

# Configurar segurança básica do Nginx
nano /etc/nginx/nginx.conf

# Adicionar/modificar no bloco http:
http {
    # Esconder versão do Nginx
    server_tokens off;

    # Limites de segurança
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # ... resto da configuração
}

# Habilitar e iniciar Nginx
systemctl enable nginx
systemctl start nginx
```

### 3.3. Instalar Certbot

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Verificar instalação
certbot --version
```

---

## 4. Configuração de Firewall

### 4.1. UFW (Uncomplicated Firewall)

```bash
# Resetar UFW
ufw --force reset

# Políticas padrão
ufw default deny incoming
ufw default allow outgoing

# Permitir SSH (porta customizada se alterou)
ufw allow 2222/tcp comment 'SSH Custom Port'

# Permitir HTTP e HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Rate limiting para SSH
ufw limit 2222/tcp comment 'SSH Rate Limit'

# Habilitar UFW
ufw --force enable

# Verificar status
ufw status verbose
```

### 4.2. IPTables - Regras Adicionais

```bash
# Instalar iptables-persistent
apt install -y iptables-persistent

# Criar script de regras avançadas
cat > /etc/iptables/rules.v4 << 'EOF'
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]

# Aceitar loopback
-A INPUT -i lo -j ACCEPT

# Aceitar conexões estabelecidas
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# SSH (porta customizada)
-A INPUT -p tcp --dport 2222 -m conntrack --ctstate NEW -m recent --set
-A INPUT -p tcp --dport 2222 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
-A INPUT -p tcp --dport 2222 -j ACCEPT

# HTTP/HTTPS
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp --dport 443 -j ACCEPT

# Ping (limitar)
-A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s -j ACCEPT
-A INPUT -p icmp --icmp-type echo-request -j DROP

# Proteção contra port scanning
-A INPUT -p tcp --tcp-flags ALL NONE -j DROP
-A INPUT -p tcp --tcp-flags ALL ALL -j DROP
-A INPUT -p tcp --tcp-flags SYN,FIN SYN,FIN -j DROP
-A INPUT -p tcp --tcp-flags SYN,RST SYN,RST -j DROP

COMMIT
EOF

# Aplicar regras
iptables-restore < /etc/iptables/rules.v4
netfilter-persistent save
```

---

## 5. Fail2Ban - Proteção contra Brute Force

### 5.1. Configuração Principal

```bash
# Copiar configuração padrão
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Editar configuração
nano /etc/fail2ban/jail.local

# Modificar seção [DEFAULT]:
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
destemail = admin@seudominio.com
sendername = Fail2Ban
action = %(action_mwl)s
```

### 5.2. Jail para SSH

```bash
cat > /etc/fail2ban/jail.d/sshd.conf << 'EOF'
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
findtime = 600
EOF
```

### 5.3. Jail para Nginx

```bash
cat > /etc/fail2ban/jail.d/nginx.conf << 'EOF'
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 60
bantime = 3600

[nginx-badbots]
enabled = true
filter = nginx-badbots
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400

[nginx-noscript]
enabled = true
filter = nginx-noscript
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 3
bantime = 3600

[nginx-noproxy]
enabled = true
filter = nginx-noproxy
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400
EOF
```

### 5.4. Filtros Customizados

```bash
# Filtro para detectar tentativas de SQL Injection
cat > /etc/fail2ban/filter.d/nginx-sqli.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* "(GET|POST).*(union|select|drop|insert|update|delete|from|where|exec|script).*HTTP.*"
ignoreregex =
EOF

# Jail para SQL Injection
cat > /etc/fail2ban/jail.d/nginx-sqli.conf << 'EOF'
[nginx-sqli]
enabled = true
filter = nginx-sqli
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 1
bantime = 172800
findtime = 300
EOF
```

### 5.5. Jail para Docker (proteção contra containers maliciosos)

```bash
cat > /etc/fail2ban/filter.d/docker-auth.conf << 'EOF'
[Definition]
failregex = ^.*docker.*authentication failure.*rhost=<HOST>
ignoreregex =
EOF

cat > /etc/fail2ban/jail.d/docker.conf << 'EOF'
[docker-auth]
enabled = true
filter = docker-auth
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF
```

### 5.6. Iniciar Fail2Ban

```bash
# Reiniciar Fail2Ban
systemctl restart fail2ban
systemctl enable fail2ban

# Verificar status
fail2ban-client status
fail2ban-client status sshd
fail2ban-client status nginx-limit-req

# Ver IPs banidos
fail2ban-client get sshd banned
```

---

## 6. Deploy da Aplicação

### 6.1. Clonar Repositório

```bash
# Como usuário deploy
su - deploy

# Criar diretório da aplicação
mkdir -p /home/deploy/apps
cd /home/deploy/apps

# Clonar repositório
git clone https://github.com/ghitflux/contabv3.git contabil
cd contabil

# Checkout para branch de produção
git checkout Main
```

### 6.2. Configurar Variáveis de Ambiente

```bash
# Copiar exemplo
cp .env.prod.example .env.prod

# Editar com valores reais
nano .env.prod
```

**Conteúdo do `.env.prod`:**

```bash
# Application
NODE_ENV=production
DEBUG=false

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=contabil_prod
POSTGRES_USER=contabil_prod
POSTGRES_PASSWORD=SENHA_FORTE_AQUI_$(openssl rand -base64 32)

# API
DATABASE_URL=postgresql+asyncpg://contabil_prod:SENHA_ACIMA@postgres:5432/contabil_prod
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend
NEXT_PUBLIC_API_URL=https://contabil.seudominio.com/api
NEXT_TELEMETRY_DISABLED=1

# Security
ALLOWED_HOSTS=contabil.seudominio.com,www.contabil.seudominio.com
CORS_ORIGINS=https://contabil.seudominio.com,https://www.contabil.seudominio.com

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-app
SMTP_FROM=noreply@seudominio.com
```

### 6.3. Build e Start dos Containers

```bash
# Build das imagens
docker compose -f docker-compose.prod.yml build --no-cache

# Subir containers
docker compose -f docker-compose.prod.yml up -d

# Verificar logs
docker compose -f docker-compose.prod.yml logs -f

# Verificar status
docker compose -f docker-compose.prod.yml ps
```

### 6.4. Aplicar Migrations

```bash
# Executar migrations
docker exec contabil-api-prod alembic upgrade head

# Verificar versão atual
docker exec contabil-api-prod alembic current
```

### 6.5. Criar Usuário Admin

```bash
# Executar script de criação
docker exec contabil-api-prod python -c "
import asyncio
import uuid
from datetime import datetime
from app.core.security import hash_password
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os

async def create_admin():
    database_url = os.getenv('DATABASE_URL')
    engine = create_async_engine(database_url, echo=False)
    async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as session:
        admin_id = str(uuid.uuid4())
        admin_email = 'admin@contabil.com'
        admin_password = 'SENHA_FORTE_AQUI'  # TROCAR DEPOIS!
        admin_name = 'Administrador'
        admin_role = 'ADMIN'

        password_hash = hash_password(admin_password)

        query = text('''
            INSERT INTO users (id, name, email, password_hash, role, is_active, is_verified, created_at, updated_at)
            VALUES (:id, :name, :email, :password_hash, :role, :is_active, :is_verified, :created_at, :updated_at)
        ''')

        await session.execute(query, {
            'id': admin_id,
            'name': admin_name,
            'email': admin_email,
            'password_hash': password_hash,
            'role': admin_role,
            'is_active': True,
            'is_verified': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })

        await session.commit()
        print('✓ Usuário admin criado com sucesso!')

asyncio.run(create_admin())
"
```

---

## 7. SSL e HTTPS

### 7.1. Configurar Nginx como Reverse Proxy

```bash
# Como root
sudo su

# Criar configuração do site
cat > /etc/nginx/sites-available/contabil.seudominio.com << 'EOF'
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=general:10m rate=200r/m;

# Upstream para API
upstream api_backend {
    least_conn;
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Upstream para Frontend
upstream web_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Redirecionamento HTTP -> HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name contabil.seudominio.com www.contabil.seudominio.com;

    # Certbot verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirecionar para HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name contabil.seudominio.com www.contabil.seudominio.com;

    # SSL Configuration (será preenchido pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/contabil.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/contabil.seudominio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    send_timeout 60s;

    # Upload
    client_max_body_size 10M;

    # Logs
    access_log /var/log/nginx/contabil-access.log;
    error_log /var/log/nginx/contabil-error.log;

    # API Backend
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;

        # Disable buffering for real-time responses
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Login endpoint (rate limited)
    location /api/v1/auth/login {
        limit_req zone=login burst=3 nodelay;

        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend Next.js
    location / {
        limit_req zone=general burst=50 nodelay;

        proxy_pass http://web_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support para Next.js HMR
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static files (cache)
    location /_next/static/ {
        proxy_pass http://web_backend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }

    # Bloquear acesso a arquivos sensíveis
    location ~ /\. {
        deny all;
    }

    location ~ /\.git {
        deny all;
    }

    location ~* \.(env|log|sql|bak)$ {
        deny all;
    }
}
EOF

# Criar link simbólico
ln -s /etc/nginx/sites-available/contabil.seudominio.com /etc/nginx/sites-enabled/

# Testar configuração
nginx -t

# Se OK, recarregar
systemctl reload nginx
```

### 7.2. Obter Certificado SSL

```bash
# Gerar certificado Let's Encrypt
certbot --nginx -d contabil.seudominio.com -d www.contabil.seudominio.com \
    --non-interactive --agree-tos --email admin@seudominio.com --redirect

# Verificar renovação automática
certbot renew --dry-run

# Configurar renovação automática (cron)
echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'" | crontab -
```

---

## 8. Monitoramento e Logs

### 8.1. Instalar Prometheus e Grafana (opcional)

```bash
# Criar docker-compose para monitoramento
cat > /home/deploy/apps/monitoring/docker-compose.yml << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "127.0.0.1:9090:9090"
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=SENHA_FORTE_AQUI
      - GF_INSTALL_PLUGINS=
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
EOF

# Criar configuração do Prometheus
cat > /home/deploy/apps/monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

# Iniciar monitoramento
cd /home/deploy/apps/monitoring
docker compose up -d
```

### 8.2. Configurar Logrotate

```bash
# Configurar rotação de logs do Docker
cat > /etc/logrotate.d/docker-containers << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
    maxsize 10M
}
EOF

# Configurar rotação de logs do Nginx
cat > /etc/logrotate.d/nginx-custom << 'EOF'
/var/log/nginx/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi
    endscript
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1
    endscript
}
EOF

# Testar logrotate
logrotate -d /etc/logrotate.d/docker-containers
logrotate -d /etc/logrotate.d/nginx-custom
```

### 8.3. Alertas via Email (opcional)

```bash
# Instalar mailutils
apt install -y mailutils

# Configurar postfix (usar "Internet Site")
dpkg-reconfigure postfix

# Script de alerta
cat > /home/deploy/scripts/alert.sh << 'EOF'
#!/bin/bash

RECIPIENT="admin@seudominio.com"
SUBJECT="[ALERTA] Servidor Contábil"

# Verificar uso de disco
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "Uso de disco crítico: ${DISK_USAGE}%" | mail -s "$SUBJECT - Disco" $RECIPIENT
fi

# Verificar uso de memória
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 90 ]; then
    echo "Uso de memória crítico: ${MEM_USAGE}%" | mail -s "$SUBJECT - Memória" $RECIPIENT
fi

# Verificar containers Docker
CONTAINERS_DOWN=$(docker ps -a | grep -v "Up" | grep -v "CONTAINER" | wc -l)
if [ "$CONTAINERS_DOWN" -gt 0 ]; then
    echo "Containers parados: $CONTAINERS_DOWN" | mail -s "$SUBJECT - Docker" $RECIPIENT
fi
EOF

chmod +x /home/deploy/scripts/alert.sh

# Adicionar ao cron (verificar a cada 30 minutos)
echo "*/30 * * * * /home/deploy/scripts/alert.sh" | crontab -u deploy -
```

---

## 9. Backups Automatizados

### 9.1. Script de Backup

```bash
# Criar diretório de backups
mkdir -p /home/deploy/backups/{database,volumes,configs}

# Script de backup
cat > /home/deploy/scripts/backup.sh << 'EOF'
#!/bin/bash

# Configurações
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Backup do banco de dados
echo "Iniciando backup do banco de dados..."
docker exec contabil-postgres-prod pg_dump -U contabil contabil_prod | gzip > \
    "$BACKUP_DIR/database/contabil_${DATE}.sql.gz"

# Backup dos volumes Docker
echo "Iniciando backup dos volumes..."
docker run --rm \
    -v contabil-postgres-data:/data \
    -v "$BACKUP_DIR/volumes:/backup" \
    alpine tar czf "/backup/volumes_${DATE}.tar.gz" -C / data

# Backup das configurações
echo "Iniciando backup das configurações..."
tar czf "$BACKUP_DIR/configs/configs_${DATE}.tar.gz" \
    /home/deploy/apps/contabil/.env.prod \
    /etc/nginx/sites-available/contabil.seudominio.com \
    /etc/fail2ban/jail.d/*.conf

# Remover backups antigos
echo "Removendo backups antigos..."
find "$BACKUP_DIR/database" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/volumes" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/configs" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Upload para S3/Backblaze (opcional)
# aws s3 sync "$BACKUP_DIR" s3://seu-bucket/backups/

echo "Backup concluído: $DATE"
EOF

chmod +x /home/deploy/scripts/backup.sh

# Testar backup
/home/deploy/scripts/backup.sh

# Agendar backup diário às 3h da manhã
echo "0 3 * * * /home/deploy/scripts/backup.sh >> /var/log/backup.log 2>&1" | crontab -u deploy -
```

### 9.2. Script de Restauração

```bash
cat > /home/deploy/scripts/restore.sh << 'EOF'
#!/bin/bash

if [ -z "$1" ]; then
    echo "Uso: $0 <arquivo_backup.sql.gz>"
    echo "Backups disponíveis:"
    ls -lh /home/deploy/backups/database/
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Erro: Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

read -p "Tem certeza que deseja restaurar o backup? Isso irá SOBRESCREVER o banco atual! (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Restauração cancelada."
    exit 0
fi

echo "Restaurando backup: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | docker exec -i contabil-postgres-prod psql -U contabil contabil_prod

echo "Restauração concluída!"
EOF

chmod +x /home/deploy/scripts/restore.sh
```

---

## 10. Atualização Automática

### 10.1. Script de Deploy Automatizado

```bash
cat > /home/deploy/scripts/auto-deploy.sh << 'EOF'
#!/bin/bash

# Configurações
APP_DIR="/home/deploy/apps/contabil"
LOG_FILE="/var/log/auto-deploy.log"
SLACK_WEBHOOK=""  # Opcional: adicionar webhook do Slack

# Função de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Função de notificação
notify() {
    log "$1"
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$1\"}" \
            "$SLACK_WEBHOOK"
    fi
}

log "========== Iniciando Deploy Automático =========="

# Navegar para diretório
cd $APP_DIR || exit 1

# Verificar se há atualizações
git fetch origin Main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/Main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "Nenhuma atualização disponível. Saindo..."
    exit 0
fi

log "Nova versão detectada. Iniciando atualização..."
notify "🚀 Deploy automático iniciado - Nova versão detectada"

# Criar backup antes de atualizar
log "Criando backup de segurança..."
/home/deploy/scripts/backup.sh

# Pull das alterações
log "Baixando alterações..."
git pull origin Main

if [ $? -ne 0 ]; then
    notify "❌ Erro ao fazer pull do repositório!"
    exit 1
fi

# Build das novas imagens
log "Building containers..."
docker compose -f docker-compose.prod.yml build --no-cache

if [ $? -ne 0 ]; then
    notify "❌ Erro no build dos containers!"
    exit 1
fi

# Rodar migrations
log "Aplicando migrations..."
docker exec contabil-api-prod alembic upgrade head

if [ $? -ne 0 ]; then
    notify "⚠️ Erro ao aplicar migrations - revisar manualmente"
fi

# Restart dos containers
log "Reiniciando containers..."
docker compose -f docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    notify "❌ Erro ao reiniciar containers!"
    exit 1
fi

# Aguardar containers ficarem saudáveis
log "Aguardando containers ficarem saudáveis..."
sleep 30

# Health check
HEALTH_API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health)
HEALTH_WEB=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)

if [ "$HEALTH_API" != "200" ] || [ "$HEALTH_WEB" != "200" ]; then
    notify "❌ Health check falhou! API: $HEALTH_API, WEB: $HEALTH_WEB"
    log "Revertendo para versão anterior..."
    git reset --hard $LOCAL
    docker compose -f docker-compose.prod.yml up -d
    exit 1
fi

# Limpar imagens antigas
log "Limpando imagens antigas..."
docker image prune -f

notify "✅ Deploy concluído com sucesso! Nova versão: $(git rev-parse --short HEAD)"
log "========== Deploy Finalizado =========="
EOF

chmod +x /home/deploy/scripts/auto-deploy.sh
```

### 10.2. Webhook de Deploy (GitHub Actions)

```bash
# Instalar webhook listener
apt install -y webhook

# Configurar webhook
mkdir -p /home/deploy/webhooks
cat > /home/deploy/webhooks/hooks.json << 'EOF'
[
  {
    "id": "deploy-contabil",
    "execute-command": "/home/deploy/scripts/auto-deploy.sh",
    "command-working-directory": "/home/deploy/apps/contabil",
    "response-message": "Deploy iniciado",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hash-sha256",
            "secret": "SEU_SECRET_AQUI",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/Main",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
EOF

# Criar serviço systemd para webhook
cat > /etc/systemd/system/webhook-deploy.service << 'EOF'
[Unit]
Description=Webhook Deploy Service
After=network.target

[Service]
Type=simple
User=deploy
ExecStart=/usr/bin/webhook -hooks /home/deploy/webhooks/hooks.json -port 9000 -ip 127.0.0.1 -verbose
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Habilitar serviço
systemctl daemon-reload
systemctl enable webhook-deploy
systemctl start webhook-deploy

# Adicionar ao Nginx (proxy para webhook)
# Adicionar dentro do server block HTTPS:
cat >> /etc/nginx/sites-available/contabil.seudominio.com << 'EOF'
    # Webhook (apenas IPs do GitHub)
    location /webhook/deploy {
        allow 140.82.112.0/20;  # GitHub IPs
        allow 143.55.64.0/20;
        deny all;

        proxy_pass http://127.0.0.1:9000/hooks/deploy-contabil;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
EOF

nginx -t && systemctl reload nginx
```

### 10.3. Atualização Automática de Pacotes do Sistema

```bash
# Instalar unattended-upgrades
apt install -y unattended-upgrades update-notifier-common

# Configurar
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
Unattended-Upgrade::Mail "admin@seudominio.com";
Unattended-Upgrade::MailReport "only-on-error";
EOF

# Habilitar atualizações automáticas
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF

# Testar
unattended-upgrade --dry-run --debug
```

---

## 11. Proteção contra Malware

### 11.1. ClamAV - Antivírus

```bash
# Instalar ClamAV
apt install -y clamav clamav-daemon

# Atualizar definições de vírus
systemctl stop clamav-freshclam
freshclam
systemctl start clamav-freshclam

# Configurar scan automático
cat > /home/deploy/scripts/scan-malware.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/clamav/scan.log"
SCAN_DIRS="/home/deploy/apps /var/lib/docker/volumes"
EMAIL="admin@seudominio.com"

echo "========== ClamAV Scan - $(date) ==========" >> $LOG_FILE

# Atualizar definições
freshclam >> $LOG_FILE 2>&1

# Scan
clamscan -r -i --exclude-dir="^/sys" --exclude-dir="^/proc" \
    $SCAN_DIRS >> $LOG_FILE 2>&1

# Verificar se encontrou vírus
if grep -q "Infected files: [1-9]" $LOG_FILE; then
    tail -50 $LOG_FILE | mail -s "[ALERTA CRÍTICO] Malware detectado no servidor!" $EMAIL
fi

echo "========== Scan finalizado ==========" >> $LOG_FILE
EOF

chmod +x /home/deploy/scripts/scan-malware.sh

# Agendar scan semanal (domingo às 2h)
echo "0 2 * * 0 /home/deploy/scripts/scan-malware.sh" | crontab -u root -
```

### 11.2. RKHunter - Rootkit Hunter

```bash
# Instalar rkhunter
apt install -y rkhunter

# Atualizar database
rkhunter --update
rkhunter --propupd

# Configurar
nano /etc/rkhunter.conf

# Modificar/adicionar:
MAIL-ON-WARNING=admin@seudominio.com
MAIL_CMD=mail -s "[rkhunter] Warnings found for ${HOST_NAME}"
ALLOW_SSH_ROOT_USER=no
ALLOW_SSH_PROT_V1=0

# Criar script de verificação
cat > /home/deploy/scripts/rkhunter-check.sh << 'EOF'
#!/bin/bash

rkhunter --update
rkhunter --check --skip-keypress --report-warnings-only

if [ $? -ne 0 ]; then
    rkhunter --check --skip-keypress | mail -s "[ALERTA] RKHunter encontrou problemas" admin@seudominio.com
fi
EOF

chmod +x /home/deploy/scripts/rkhunter-check.sh

# Agendar verificação diária
echo "0 4 * * * /home/deploy/scripts/rkhunter-check.sh" | crontab -u root -
```

### 11.3. Lynis - Auditoria de Segurança

```bash
# Instalar Lynis
apt install -y lynis

# Executar auditoria completa
lynis audit system

# Criar relatório
lynis audit system --quick --quiet | grep Warning > /var/log/lynis-warnings.log

# Agendar auditoria mensal
echo "0 3 1 * * lynis audit system --cronjob | mail -s 'Lynis Security Audit' admin@seudominio.com" | crontab -u root -
```

### 11.4. AIDE - Detecção de Intrusão

```bash
# Instalar AIDE
apt install -y aide

# Inicializar database
aideinit

# Copiar database
cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Configurar verificação diária
cat > /etc/cron.daily/aide-check << 'EOF'
#!/bin/bash

/usr/bin/aide --check | mail -s "[AIDE] File Integrity Check" admin@seudominio.com
EOF

chmod +x /etc/cron.daily/aide-check
```

### 11.5. Monitoramento de Processos Suspeitos

```bash
# Script para detectar processos suspeitos
cat > /home/deploy/scripts/check-cryptominers.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/cryptominer-check.log"
ALERT_EMAIL="admin@seudominio.com"

# Lista de processos suspeitos (miners conhecidos)
SUSPICIOUS_PROCS="xmrig minerd ccminer ethminer claymore phoenix cryptonight nicehash"

echo "========== Verificação de Cryptominers - $(date) ==========" >> $LOG_FILE

# Verificar processos
for proc in $SUSPICIOUS_PROCS; do
    if pgrep -x "$proc" > /dev/null; then
        echo "ALERTA: Processo suspeito detectado: $proc" | tee -a $LOG_FILE
        pkill -9 "$proc"
        echo "Processo $proc foi terminado" | tee -a $LOG_FILE
        ps aux | grep "$proc" | mail -s "[ALERTA CRÍTICO] Cryptominer detectado: $proc" $ALERT_EMAIL
    fi
done

# Verificar alto uso de CPU (possível miner desconhecido)
HIGH_CPU=$(ps aux | awk '{if ($3 > 80.0) print $0}')
if [ -n "$HIGH_CPU" ]; then
    echo "Processos com alto uso de CPU:" >> $LOG_FILE
    echo "$HIGH_CPU" >> $LOG_FILE
fi

# Verificar conexões suspeitas (portas de mining)
MINING_PORTS="3333 4444 5555 7777 8888 14444 45560"
for port in $MINING_PORTS; do
    CONN=$(netstat -plant 2>/dev/null | grep ":$port")
    if [ -n "$CONN" ]; then
        echo "ALERTA: Conexão suspeita na porta $port" | tee -a $LOG_FILE
        echo "$CONN" | tee -a $LOG_FILE
        echo "$CONN" | mail -s "[ALERTA] Conexão suspeita na porta $port" $ALERT_EMAIL
    fi
done

echo "========== Verificação finalizada ==========" >> $LOG_FILE
EOF

chmod +x /home/deploy/scripts/check-cryptominers.sh

# Executar a cada 15 minutos
echo "*/15 * * * * /home/deploy/scripts/check-cryptominers.sh" | crontab -u root -
```

### 11.6. Docker Security Scanning

```bash
# Instalar Trivy (scanner de vulnerabilidades)
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list
apt update
apt install -y trivy

# Script de scan de imagens Docker
cat > /home/deploy/scripts/scan-docker-images.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/docker-scan.log"
EMAIL="admin@seudominio.com"

echo "========== Docker Images Security Scan - $(date) ==========" >> $LOG_FILE

# Scan de todas as imagens em uso
for image in $(docker images --format "{{.Repository}}:{{.Tag}}" | grep -v "<none>"); do
    echo "Scanning $image..." >> $LOG_FILE
    trivy image --severity HIGH,CRITICAL $image >> $LOG_FILE 2>&1
done

# Verificar se há vulnerabilidades críticas
if grep -q "Total: [1-9]" $LOG_FILE; then
    tail -100 $LOG_FILE | mail -s "[ALERTA] Vulnerabilidades encontradas em imagens Docker" $EMAIL
fi

echo "========== Scan finalizado ==========" >> $LOG_FILE
EOF

chmod +x /home/deploy/scripts/scan-docker-images.sh

# Executar semanalmente
echo "0 5 * * 1 /home/deploy/scripts/scan-docker-images.sh" | crontab -u root -
```

---

## 12. Manutenção e Troubleshooting

### 12.1. Comandos Úteis

```bash
# Ver logs em tempo real
docker compose -f docker-compose.prod.yml logs -f

# Ver logs de um container específico
docker logs contabil-api-prod -f --tail=100

# Verificar uso de recursos
docker stats

# Verificar saúde dos containers
docker compose -f docker-compose.prod.yml ps

# Restart de um container específico
docker compose -f docker-compose.prod.yml restart api

# Rebuild e restart
docker compose -f docker-compose.prod.yml up -d --build api

# Limpar recursos não utilizados
docker system prune -a -f

# Verificar conexões ativas
netstat -tunlp | grep LISTEN

# Ver IPs banidos pelo Fail2Ban
fail2ban-client status sshd

# Desbanir um IP
fail2ban-client set sshd unbanip 192.168.1.100

# Ver logs do Nginx
tail -f /var/log/nginx/contabil-error.log
tail -f /var/log/nginx/contabil-access.log

# Testar configuração do Nginx
nginx -t

# Recarregar Nginx sem downtime
systemctl reload nginx

# Ver uso de disco
df -h
du -sh /var/lib/docker
du -sh /home/deploy/backups

# Ver processos consumindo mais recursos
htop
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10

# Verificar portas abertas
netstat -tulpn
ss -tulpn
```

### 12.2. Rollback de Deploy

```bash
cat > /home/deploy/scripts/rollback.sh << 'EOF'
#!/bin/bash

if [ -z "$1" ]; then
    echo "Uso: $0 <commit-hash>"
    echo "Últimos 10 commits:"
    cd /home/deploy/apps/contabil
    git log --oneline -10
    exit 1
fi

COMMIT=$1
APP_DIR="/home/deploy/apps/contabil"

cd $APP_DIR

# Backup antes de rollback
/home/deploy/scripts/backup.sh

# Rollback do código
git reset --hard $COMMIT

# Rebuild
docker compose -f docker-compose.prod.yml build

# Restart
docker compose -f docker-compose.prod.yml up -d

echo "Rollback concluído para commit: $COMMIT"
EOF

chmod +x /home/deploy/scripts/rollback.sh
```

### 12.3. Health Check Script

```bash
cat > /home/deploy/scripts/health-check.sh << 'EOF'
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========== HEALTH CHECK - $(date) =========="

# Check Docker
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓${NC} Docker: Running"
else
    echo -e "${RED}✗${NC} Docker: Not running"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx: Running"
else
    echo -e "${RED}✗${NC} Nginx: Not running"
fi

# Check Fail2Ban
if systemctl is-active --quiet fail2ban; then
    echo -e "${GREEN}✓${NC} Fail2Ban: Running"
else
    echo -e "${RED}✗${NC} Fail2Ban: Not running"
fi

# Check Containers
CONTAINERS=$(docker compose -f /home/deploy/apps/contabil/docker-compose.prod.yml ps -q)
for container in $CONTAINERS; do
    STATUS=$(docker inspect -f '{{.State.Status}}' $container)
    NAME=$(docker inspect -f '{{.Name}}' $container | sed 's/\///')

    if [ "$STATUS" == "running" ]; then
        echo -e "${GREEN}✓${NC} Container $NAME: Running"
    else
        echo -e "${RED}✗${NC} Container $NAME: $STATUS"
    fi
done

# Check Disk Usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo -e "${RED}✗${NC} Disk Usage: ${DISK_USAGE}% (CRITICAL)"
elif [ "$DISK_USAGE" -gt 70 ]; then
    echo -e "${YELLOW}⚠${NC} Disk Usage: ${DISK_USAGE}% (Warning)"
else
    echo -e "${GREEN}✓${NC} Disk Usage: ${DISK_USAGE}%"
fi

# Check Memory Usage
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 90 ]; then
    echo -e "${RED}✗${NC} Memory Usage: ${MEM_USAGE}% (CRITICAL)"
elif [ "$MEM_USAGE" -gt 80 ]; then
    echo -e "${YELLOW}⚠${NC} Memory Usage: ${MEM_USAGE}% (Warning)"
else
    echo -e "${GREEN}✓${NC} Memory Usage: ${MEM_USAGE}%"
fi

# Check API Health
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health)
if [ "$API_HEALTH" == "200" ]; then
    echo -e "${GREEN}✓${NC} API Health: OK (200)"
else
    echo -e "${RED}✗${NC} API Health: FAIL ($API_HEALTH)"
fi

# Check Web Health
WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$WEB_HEALTH" == "200" ] || [ "$WEB_HEALTH" == "307" ]; then
    echo -e "${GREEN}✓${NC} Web Health: OK ($WEB_HEALTH)"
else
    echo -e "${RED}✗${NC} Web Health: FAIL ($WEB_HEALTH)"
fi

# Check SSL Certificate Expiration
CERT_DAYS=$(echo | openssl s_client -servername contabil.seudominio.com -connect contabil.seudominio.com:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2 | xargs -I {} date -d {} +%s)
CURRENT=$(date +%s)
DAYS_LEFT=$(( ($CERT_DAYS - $CURRENT) / 86400 ))

if [ "$DAYS_LEFT" -lt 10 ]; then
    echo -e "${RED}✗${NC} SSL Certificate: Expires in $DAYS_LEFT days (CRITICAL)"
elif [ "$DAYS_LEFT" -lt 30 ]; then
    echo -e "${YELLOW}⚠${NC} SSL Certificate: Expires in $DAYS_LEFT days (Warning)"
else
    echo -e "${GREEN}✓${NC} SSL Certificate: Valid for $DAYS_LEFT days"
fi

echo "=========================================="
EOF

chmod +x /home/deploy/scripts/health-check.sh

# Executar health check a cada hora
echo "0 * * * * /home/deploy/scripts/health-check.sh >> /var/log/health-check.log" | crontab -u deploy -
```

---

## 13. Procedimentos de Atualização (Dev → Produção)

### 13.1. Workflow de Atualização Rápida

Este é o procedimento padrão para atualizar a aplicação após fazer alterações locais.

#### Método 1: Push + Deploy Automático (Recomendado)

```bash
# 1. No seu computador local (desenvolvimento)
# Após fazer suas alterações e testar localmente:

# Commit das alterações
git add .
git commit -m "feat: sua descrição aqui"

# Push para o repositório
git push origin Main

# 2. No servidor (automático via webhook)
# O webhook detecta o push e executa auto-deploy.sh automaticamente
# Aguarde 2-3 minutos e verifique se o deploy foi concluído
```

#### Método 2: SSH Deploy Manual (Mais Controle)

```bash
# 1. No seu computador local
git add .
git commit -m "feat: sua descrição"
git push origin Main

# 2. Conectar ao servidor
ssh deploy@SEU_SERVIDOR_IP -p 2222

# 3. Executar script de deploy
cd /home/deploy/apps/contabil
/home/deploy/scripts/auto-deploy.sh

# 4. Acompanhar logs
docker compose -f docker-compose.prod.yml logs -f
```

#### Método 3: Deploy Direto via SSH (Emergência)

```bash
# Executar comandos remotamente sem fazer login interativo
ssh deploy@SEU_SERVIDOR_IP -p 2222 << 'ENDSSH'
cd /home/deploy/apps/contabil
git pull origin Main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker exec contabil-api-prod alembic upgrade head
echo "Deploy concluído!"
ENDSSH

# Verificar saúde da aplicação
ssh deploy@SEU_SERVIDOR_IP -p 2222 "curl -s http://localhost:8000/api/v1/health"
```

### 13.2. Deploy de Apenas Frontend ou Backend

```bash
# Conectar ao servidor
ssh deploy@SEU_SERVIDOR_IP -p 2222

# Atualizar apenas Frontend
cd /home/deploy/apps/contabil
git pull origin Main
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web

# Atualizar apenas Backend
cd /home/deploy/apps/contabil
git pull origin Main
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api
docker exec contabil-api-prod alembic upgrade head
```

### 13.3. Deploy com Migração de Banco de Dados

```bash
# Quando há alterações no banco de dados

# 1. Conectar ao servidor
ssh deploy@SEU_SERVIDOR_IP -p 2222

# 2. Backup OBRIGATÓRIO antes de migrations
/home/deploy/scripts/backup.sh

# 3. Atualizar código
cd /home/deploy/apps/contabil
git pull origin Main

# 4. Verificar migrations pendentes
docker exec contabil-api-prod alembic current
docker exec contabil-api-prod alembic history | head -20

# 5. Aplicar migrations
docker exec contabil-api-prod alembic upgrade head

# 6. Verificar se migrations foram aplicadas
docker exec contabil-api-prod alembic current

# 7. Rebuild e restart (se necessário)
docker compose -f docker-compose.prod.yml up -d --build
```

### 13.4. Hot Deploy (Zero Downtime)

Para atualizações sem parar a aplicação:

```bash
# 1. Build das novas imagens com tags temporárias
ssh deploy@SEU_SERVIDOR_IP -p 2222 << 'ENDSSH'
cd /home/deploy/apps/contabil
git pull origin Main

# Build com tag temporária
docker build -t contabilconsult-api:new -f apps/api/Dockerfile apps/api
docker build -t contabilconsult-web:new -f Dockerfile.web.prod .

# Criar containers temporários
docker run -d --name api-new --network contabilconsult_default \
  --env-file .env.prod \
  contabilconsult-api:new

# Aguardar health check
sleep 30

# Verificar saúde do novo container
if curl -f http://localhost:8001/api/v1/health; then
  # Trocar containers (swap)
  docker compose -f docker-compose.prod.yml stop api
  docker rm contabil-api-prod
  docker run -d --name contabil-api-prod --network contabilconsult_default \
    -p 8000:8000 --env-file .env.prod contabilconsult-api:new
  echo "✓ API atualizada com sucesso!"
else
  docker stop api-new
  docker rm api-new
  echo "✗ Health check falhou. Mantendo versão anterior."
fi
ENDSSH
```

### 13.5. Script Auxiliar de Deploy Rápido (Local)

Crie este script no seu computador local para facilitar o deploy:

```bash
# Salvar como: ~/scripts/deploy-contabil.sh
cat > ~/scripts/deploy-contabil.sh << 'EOF'
#!/bin/bash

# Configurações
SERVER="deploy@SEU_IP"
PORT="2222"
APP_DIR="/home/deploy/apps/contabil"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========== Deploy ContabilConsult ==========${NC}"

# 1. Verificar se há alterações locais não commitadas
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}✗ Há alterações não commitadas!${NC}"
  git status --short
  read -p "Deseja commitar agora? (s/n): " commit
  if [ "$commit" = "s" ]; then
    read -p "Mensagem do commit: " msg
    git add .
    git commit -m "$msg"
  else
    echo "Deploy cancelado."
    exit 1
  fi
fi

# 2. Push para repositório
echo -e "${YELLOW}→ Fazendo push para repositório...${NC}"
git push origin Main
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Erro no push!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Push concluído${NC}"

# 3. Conectar ao servidor e fazer deploy
echo -e "${YELLOW}→ Conectando ao servidor...${NC}"
ssh -p $PORT $SERVER << ENDSSH
set -e
cd $APP_DIR

echo "→ Fazendo pull das alterações..."
git pull origin Main

echo "→ Criando backup..."
/home/deploy/scripts/backup.sh

echo "→ Building containers..."
docker compose -f docker-compose.prod.yml build

echo "→ Aplicando migrations..."
docker exec contabil-api-prod alembic upgrade head || true

echo "→ Reiniciando containers..."
docker compose -f docker-compose.prod.yml up -d

echo "→ Aguardando containers ficarem saudáveis..."
sleep 30

echo "→ Verificando saúde da aplicação..."
API_HEALTH=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health)
WEB_HEALTH=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)

if [ "\$API_HEALTH" = "200" ] && [ "\$WEB_HEALTH" = "200" ] || [ "\$WEB_HEALTH" = "307" ]; then
  echo "✓ Deploy concluído com sucesso!"
  echo "  API: \$API_HEALTH"
  echo "  WEB: \$WEB_HEALTH"
else
  echo "✗ Health check falhou!"
  echo "  API: \$API_HEALTH"
  echo "  WEB: \$WEB_HEALTH"
  exit 1
fi
ENDSSH

if [ $? -eq 0 ]; then
  echo -e "${GREEN}========== Deploy Finalizado com Sucesso! ==========${NC}"

  # Notificação (macOS)
  if command -v osascript &> /dev/null; then
    osascript -e 'display notification "Deploy concluído!" with title "ContabilConsult"'
  fi

  # Notificação (Linux com notify-send)
  if command -v notify-send &> /dev/null; then
    notify-send "ContabilConsult" "Deploy concluído!"
  fi
else
  echo -e "${RED}========== Deploy Falhou! ==========${NC}"
  exit 1
fi
EOF

chmod +x ~/scripts/deploy-contabil.sh

# Criar alias para facilitar
echo 'alias deploy-contabil="~/scripts/deploy-contabil.sh"' >> ~/.bashrc
source ~/.bashrc
```

### 13.6. Deploy via VS Code (Opcional)

Se você usa VS Code, pode adicionar tasks para deploy:

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Deploy para Produção",
      "type": "shell",
      "command": "~/scripts/deploy-contabil.sh",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Ver Logs Produção (API)",
      "type": "shell",
      "command": "ssh -p 2222 deploy@SEU_IP 'docker logs contabil-api-prod -f --tail=100'",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },
    {
      "label": "Ver Logs Produção (Web)",
      "type": "shell",
      "command": "ssh -p 2222 deploy@SEU_IP 'docker logs contabil-web-prod -f --tail=100'",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      }
    },
    {
      "label": "Health Check Produção",
      "type": "shell",
      "command": "ssh -p 2222 deploy@SEU_IP '/home/deploy/scripts/health-check.sh'",
      "problemMatcher": []
    }
  ]
}
```

### 13.7. Comandos Úteis de Deploy

```bash
# Ver status dos containers remotamente
ssh -p 2222 deploy@SEU_IP "docker compose -f /home/deploy/apps/contabil/docker-compose.prod.yml ps"

# Ver logs em tempo real
ssh -p 2222 deploy@SEU_IP "docker compose -f /home/deploy/apps/contabil/docker-compose.prod.yml logs -f"

# Restart rápido (sem rebuild)
ssh -p 2222 deploy@SEU_IP "docker compose -f /home/deploy/apps/contabil/docker-compose.prod.yml restart"

# Verificar última versão deployada
ssh -p 2222 deploy@SEU_IP "cd /home/deploy/apps/contabil && git log -1 --oneline"

# Comparar versão local vs servidor
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(ssh -p 2222 deploy@SEU_IP "cd /home/deploy/apps/contabil && git rev-parse HEAD")
if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
  echo "✓ Servidor está na mesma versão local"
else
  echo "✗ Servidor está em versão diferente"
  echo "Local:  $LOCAL_COMMIT"
  echo "Remoto: $REMOTE_COMMIT"
fi
```

### 13.8. Checklist de Deploy

Use esta checklist antes de cada deploy:

```
PRÉ-DEPLOY:
[ ] Código testado localmente
[ ] Testes automatizados passando
[ ] Migrations testadas localmente
[ ] Variáveis de ambiente atualizadas (.env.prod)
[ ] Changelog/Release notes preparados
[ ] Branch correta (Main)

DURANTE DEPLOY:
[ ] Backup criado automaticamente
[ ] Git pull executado
[ ] Containers buildados sem erros
[ ] Migrations aplicadas com sucesso
[ ] Containers reiniciados

PÓS-DEPLOY:
[ ] Health check API retorna 200
[ ] Health check Web retorna 200/307
[ ] Login funciona
[ ] Funcionalidades críticas testadas
[ ] Logs sem erros críticos
[ ] Monitoramento sem alertas
[ ] Comunicar time sobre deploy
```

### 13.9. Troubleshooting de Deploy

**Problema: Deploy falha no build**
```bash
# Limpar cache do Docker e rebuild
ssh -p 2222 deploy@SEU_IP << 'ENDSSH'
cd /home/deploy/apps/contabil
docker compose -f docker-compose.prod.yml down
docker system prune -a -f
git pull origin Main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
ENDSSH
```

**Problema: Migrations falhando**
```bash
# Ver logs da migration
ssh -p 2222 deploy@SEU_IP "docker exec contabil-api-prod alembic upgrade head --verbose"

# Fazer downgrade e subir novamente
ssh -p 2222 deploy@SEU_IP "docker exec contabil-api-prod alembic downgrade -1"
ssh -p 2222 deploy@SEU_IP "docker exec contabil-api-prod alembic upgrade head"
```

**Problema: Container não inicia**
```bash
# Ver logs detalhados
ssh -p 2222 deploy@SEU_IP "docker logs contabil-api-prod --tail=200"
ssh -p 2222 deploy@SEU_IP "docker logs contabil-web-prod --tail=200"

# Inspecionar container
ssh -p 2222 deploy@SEU_IP "docker inspect contabil-api-prod"
```

**Problema: Deploy automático (webhook) não funcionando**
```bash
# Ver logs do webhook
ssh -p 2222 deploy@SEU_IP "journalctl -u webhook-deploy -n 50 -f"

# Verificar se webhook está rodando
ssh -p 2222 deploy@SEU_IP "systemctl status webhook-deploy"

# Testar webhook manualmente
curl -X POST https://contabil.seudominio.com/webhook/deploy \
  -H "X-Hub-Signature-256: sha256=$(echo -n 'payload' | openssl dgst -sha256 -hmac 'SEU_SECRET' | sed 's/^.* //')" \
  -d '{"ref":"refs/heads/Main"}'
```

---

## 📚 Checklist Final de Deploy

### Pré-Deploy
- [ ] VPS provisionado na Hostinger
- [ ] DNS apontado para o IP do servidor
- [ ] Acesso SSH configurado com chave pública
- [ ] Usuário de deploy criado (não usar root)

### Segurança
- [ ] SSH configurado (porta customizada, sem root, sem senha)
- [ ] UFW configurado e ativo
- [ ] Fail2Ban configurado para SSH, Nginx e Docker
- [ ] Fail2Ban configurado para SQL Injection
- [ ] Auditd configurado para monitorar arquivos críticos
- [ ] ClamAV instalado e agendado
- [ ] RKHunter instalado e agendado
- [ ] AIDE configurado para integridade de arquivos
- [ ] Script anti-cryptominer rodando
- [ ] Trivy escaneando imagens Docker

### Aplicação
- [ ] Docker instalado e configurado
- [ ] Docker Compose instalado
- [ ] Repositório clonado
- [ ] .env.prod configurado com senhas fortes
- [ ] Containers buildados e rodando
- [ ] Migrations aplicadas
- [ ] Usuário admin criado

### Nginx e SSL
- [ ] Nginx instalado e configurado
- [ ] Reverse proxy configurado
- [ ] Rate limiting configurado
- [ ] Security headers configurados
- [ ] Certificado SSL gerado (Let's Encrypt)
- [ ] HTTPS funcionando
- [ ] Redirecionamento HTTP → HTTPS ativo
- [ ] Renovação automática SSL configurada

### Monitoramento
- [ ] Logs configurados (Docker, Nginx)
- [ ] Logrotate configurado
- [ ] Health check script rodando
- [ ] Alertas por email configurados
- [ ] Prometheus/Grafana instalados (opcional)

### Backups
- [ ] Script de backup criado
- [ ] Backup de banco de dados funcionando
- [ ] Backup de volumes funcionando
- [ ] Backup de configurações funcionando
- [ ] Retenção de 30 dias configurada
- [ ] Script de restore testado

### Automação
- [ ] Deploy automático via webhook (opcional)
- [ ] Atualização automática de pacotes configurada
- [ ] Cron jobs configurados:
  - [ ] Backup diário (3h)
  - [ ] Health check (a cada hora)
  - [ ] ClamAV scan (semanal)
  - [ ] RKHunter check (diário)
  - [ ] Lynis audit (mensal)
  - [ ] Cryptominer check (15 min)
  - [ ] Docker scan (semanal)

### Testes Finais
- [ ] API health check retorna 200
- [ ] Frontend carrega corretamente
- [ ] Login funciona
- [ ] HTTPS com cadeado verde
- [ ] Rate limiting testado
- [ ] Fail2Ban testado (bloquear IP temporário)
- [ ] Backup e restore testados
- [ ] Rollback testado

---

## 🔐 Senhas e Chaves

**IMPORTANTE:** Gerar senhas fortes para TODAS as credenciais:

```bash
# Gerar senha aleatória forte
openssl rand -base64 32

# Gerar chave secreta
openssl rand -hex 32

# Gerar hash de senha
echo -n "SuaSenha" | sha256sum
```

**Armazenar com segurança:**
- Use um gerenciador de senhas (1Password, Bitwarden, LastPass)
- Documente todas as credenciais em local seguro
- Nunca commite senhas no Git

---

## 📞 Suporte e Manutenção

### Contatos Importantes
- **Email de Alerta**: admin@seudominio.com
- **Slack/Discord**: (opcional)
- **Hostinger Support**: https://www.hostinger.com.br/suporte

### Manutenção Regular

**Diária:**
- Verificar logs de erro
- Verificar alertas de monitoramento
- Verificar IPs banidos pelo Fail2Ban

**Semanal:**
- Revisar logs de acesso
- Verificar uso de disco e memória
- Revisar backups

**Mensal:**
- Executar auditoria de segurança (Lynis)
- Revisar e atualizar regras de firewall
- Testar restore de backup
- Revisar certificados SSL

**Trimestral:**
- Atualizar dependências (npm, pip)
- Revisar e otimizar configurações
- Teste de carga e performance

---

## ✅ Deploy Concluído!

Após seguir todos os passos deste documento, você terá:

✅ Servidor Ubuntu hardened e seguro
✅ Aplicação rodando em containers Docker
✅ SSL/HTTPS com Let's Encrypt
✅ Proteção contra brute force (Fail2Ban)
✅ Proteção contra malware e cryptominers
✅ Backups automatizados
✅ Deploy automatizado via webhook
✅ Monitoramento e alertas
✅ Logs centralizados e rotacionados

**Sistema pronto para produção! 🚀**

---

**Documentação criada em**: 2026-01-07
**Versão**: 1.0
**Autor**: Claude Code (Sonnet 4.5)
**Licença**: MIT
