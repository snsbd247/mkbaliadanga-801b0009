#!/usr/bin/env bash
# Restore from a backup archive produced by backup.sh.
# Usage: bash restore.sh /var/backups/mkbaliadanga/full-2026-05-13-0200.tgz
set -euo pipefail
ARCHIVE="${1:?archive path required}"
APP_DIR="${APP_DIR:-/home/mkadmin/mkbaliadanga}"
[ -f "$ARCHIVE" ] || { echo "Archive not found: $ARCHIVE"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "[restore] Extracting..."
tar -xzf "$ARCHIVE" -C "$WORK"
DB_DUMP="$(ls "$WORK"/db-*.dump | head -1)"
MINIO_DIR="$(ls -d "$WORK"/minio-* | head -1)"

cd "$APP_DIR/infra"
set -a; source "$APP_DIR/.env"; set +a

echo "[restore] Stopping API to avoid writes..."
docker compose stop api

echo "[restore] Recreating database..."
docker compose exec -T postgres psql -U "$PG_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$PG_DB\";"
docker compose exec -T postgres createdb -U "$PG_USER" "$PG_DB"

echo "[restore] Loading dump..."
cat "$DB_DUMP" | docker compose exec -T postgres pg_restore -U "$PG_USER" -d "$PG_DB"

echo "[restore] Restoring MinIO buckets..."
docker run --rm --network mk_net \
  -v "$MINIO_DIR:/in" \
  -e MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  minio/mc mirror --overwrite /in local

echo "[restore] Starting API..."
docker compose start api

echo "[restore] Done."
