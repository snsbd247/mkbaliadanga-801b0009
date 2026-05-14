#!/usr/bin/env bash
# Nightly backup: pg_dump + MinIO mirror, packed + rotated.
set -euo pipefail
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/mkbaliadanga}"
OUT="${BACKUP_DIR:-/var/backups/mkbaliadanga}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$OUT"
TS="$(date +%F-%H%M)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$APP_DIR/backend"
set -a; source "$APP_DIR/backend/.env"; set +a

echo "[backup] Dumping Postgres..."
docker compose exec -T postgres \
  pg_dump -U "$DB_USERNAME" -Fc "$DB_DATABASE" > "$WORK/db-$TS.dump"

echo "[backup] Mirroring MinIO buckets..."
docker run --rm --network mkb-laravel_mkb_net \
  -v "$WORK:/out" \
  -e MC_HOST_local="http://${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}@minio:9000" \
  minio/mc mirror --overwrite local /out/minio-$TS || \
  echo "[backup] (MinIO mirror skipped — bucket may be empty)"

echo "[backup] Packing archive..."
ARCHIVE="$OUT/full-$TS.tgz"
tar -czf "$ARCHIVE" -C "$WORK" .

echo "[backup] Rotating (>${RETENTION_DAYS}d)..."
find "$OUT" -name 'full-*.tgz' -mtime +${RETENTION_DAYS} -delete

echo "[backup] OK → $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
