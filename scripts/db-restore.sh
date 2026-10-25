#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Использование: $0 <path-to-backup.dump>"
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Файл backup не найден: $BACKUP_FILE"
  exit 1
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-mini-crm-postgres}"
POSTGRES_DB="${POSTGRES_DB:-mini_crm}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/mini_crm?schema=public}"

echo "Восстанавливаем базу из backup: $BACKUP_FILE"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -Eq "^${POSTGRES_CONTAINER}$"; then
  cat "$BACKUP_FILE" | docker exec -i "$POSTGRES_CONTAINER" pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges
else
  pg_restore \
    --dbname="$DATABASE_URL" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "$BACKUP_FILE"
fi

echo "Восстановление завершено."
