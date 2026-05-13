#!/usr/bin/env bash
# Nightly backup: pg_dump + MinIO mirror, packed + rotated.
set -euo pipefail
APP_DIR="${APP_DIR:-/home/mkadmin/mkbaliadanga}"
OUT="${BACKUP_DIR:-/var/backups/mkbaliadanga}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$OUT"
TS="$(date +%F-%H%M)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$APP_DIR/infra"
set -a; source "$APP_DIR/.env"; set +a

echo "[backup] Dumping Postgres..."
docker compose exec -T postgres \
  pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$WORK/db-$TS.dump"

echo "[backup] Mirroring MinIO buckets..."
docker run --rm --network mk_net \
  -v "$WORK:/out" \
  -e MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  minio/mc mirror --overwrite local /out/minio-$TS

echo "[backup] Packing archive..."
ARCHIVE="$OUT/full-$TS.tgz"
tar -czf "$ARCHIVE" -C "$WORK" "db-$TS.dump" "minio-$TS"

echo "[backup] Rotating (>${RETENTION_DAYS}d)..."
find "$OUT" -name 'full-*.tgz' -mtime +${RETENTION_DAYS} -delete

echo "[backup] OK → $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
