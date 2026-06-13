#!/usr/bin/env bash
# =============================================================================
# deploy/backup.sh — daily backup of PostgreSQL, Storage, and env files.
# Retention: BACKUP_RETENTION_DAYS (default 30). Idempotent, safe to re-run.
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_env

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/$STAMP"
mkdir -p "$DEST"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"

log "Backup started -> $DEST"

# 1) PostgreSQL (full cluster dump)
if docker ps --format '{{.Names}}' | grep -q '^supabase-db$'; then
  docker exec -t supabase-db pg_dumpall -U "${POSTGRES_USER}" | gzip > "$DEST/postgres-all.sql.gz"
  ok "PostgreSQL dump saved ($(du -h "$DEST/postgres-all.sql.gz" | cut -f1))"
else
  warn "supabase-db not running — skipping DB dump."
fi

# 2) Storage volume (object files)
if docker volume inspect deploy_supabase-storage-data >/dev/null 2>&1; then
  docker run --rm -v deploy_supabase-storage-data:/data -v "$DEST":/backup alpine \
    sh -c "tar czf /backup/storage.tar.gz -C /data ." && ok "Storage volume archived."
else
  warn "Storage volume not found — skipping."
fi

# 3) Environment + rendered config
cp -f "$ENV_FILE" "$DEST/.env.production" 2>/dev/null && ok "Env file copied."
cp -f "$DEPLOY_DIR/supabase/kong.yml" "$DEST/kong.yml" 2>/dev/null || true

# Checksum manifest
( cd "$DEST" && sha256sum ./* > MANIFEST.sha256 2>/dev/null || true )

# 4) Retention prune
find "$BACKUP_DIR" -maxdepth 1 -type d -name '20*' -mtime +"$RETENTION" -exec rm -rf {} + 2>/dev/null || true
ok "Old backups older than ${RETENTION}d pruned."

ok "Backup complete: $DEST"
