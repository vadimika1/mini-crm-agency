#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${1:-$BACKUP_DIR/mini-crm-${TIMESTAMP}.dump}"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-mini-crm-postgres}"
POSTGRES_DB="${POSTGRES_DB:-mini_crm}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/mini_crm?schema=public}"

mkdir -p "$BACKUP_DIR"

echo "Создаем backup базы данных: $OUTPUT_FILE"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -Eq "^${POSTGRES_CONTAINER}$"; then
  docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$OUTPUT_FILE"
else
  pg_dump "$DATABASE_URL" -Fc >"$OUTPUT_FILE"
fi

echo "Backup завершен: $OUTPUT_FILE"
