#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/contabilconsult/backups"
TIMESTAMP=$(date +%F_%H-%M)

echo "📦 Iniciando backup ($TIMESTAMP)..."

mkdir -p "$BACKUP_DIR"

# Backup do banco
echo "📊 Backup do banco de dados..."
docker exec -t contabil-postgres-prod pg_dump -U contabil -F c -d contabil_db \
  > "$BACKUP_DIR/contabil_db_$TIMESTAMP.dump"

gzip -9 "$BACKUP_DIR/contabil_db_$TIMESTAMP.dump"
echo "✅ Banco: $BACKUP_DIR/contabil_db_$TIMESTAMP.dump.gz"

# Backup de uploads
echo "📁 Backup de uploads..."
docker run --rm \
  -v contabil_api_uploads:/data \
  -v "$BACKUP_DIR":/backup \
  alpine:3.20 \
  sh -c "tar -czf /backup/uploads_$TIMESTAMP.tar.gz -C /data ."

echo "✅ Uploads: $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"

# Limpar backups antigos (manter últimos 7 dias)
echo "🧹 Limpando backups antigos..."
find "$BACKUP_DIR" -type f -mtime +7 -delete

# Listar backups
echo ""
echo "📋 Backups disponíveis:"
ls -lh "$BACKUP_DIR"

echo ""
echo "✅ Backup concluído!"
