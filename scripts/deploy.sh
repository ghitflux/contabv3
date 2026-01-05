#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Iniciando deploy..."

cd /opt/contabilconsult

# 1. Backup do banco
echo "📦 Fazendo backup do banco..."
TIMESTAMP=$(date +%F_%H-%M)
mkdir -p backups
docker exec -t contabil-postgres-prod pg_dump -U contabil -F c -d contabil_db > backups/contabil_db_$TIMESTAMP.dump || echo "⚠️  Backup falhou (primeira instalação?)"

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
sleep 15
docker compose -f docker-compose.prod.yml ps

# 6. Testar API
echo "🧪 Testando API..."
if curl -f http://127.0.0.1:8000/api/v1/health; then
    echo "✅ API health check OK!"
else
    echo "❌ API health check falhou!"
    exit 1
fi

echo ""
echo "✅ Deploy concluído!"
echo "📊 Logs da API: docker compose -f docker-compose.prod.yml logs -f api"
echo "🌐 Acesse: https://testecic.ghitflux.com"
