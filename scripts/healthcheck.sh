#!/usr/bin/env bash

API_URL="https://testecic.ghitflux.com/api/v1/health"
WEB_URL="https://testecic.ghitflux.com"

echo "🏥 Health Check - $(date)"
echo "========================================"

# Testar API
echo -n "API ($API_URL): "
if curl -f -s "$API_URL" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FALHOU"
fi

# Testar Web
echo -n "WEB ($WEB_URL): "
if curl -f -s -I "$WEB_URL" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FALHOU"
fi

echo ""
echo "📦 Status dos Containers:"
docker compose -f /opt/contabilconsult/docker-compose.prod.yml ps

echo ""
echo "💾 Uso de Disco:"
df -h / | tail -1

echo ""
echo "🐳 Uso de Recursos (Docker):"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo "========================================"
