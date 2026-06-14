#!/usr/bin/env bash
# =============================================================================
# deploy/restore.sh — restore the full system from a backup directory.
#   sudo bash restore.sh /opt/mkbaliadanga-backups/<STAMP>
#   sudo bash restore.sh latest
# Restores: env file, PostgreSQL cluster, Storage volume.
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
need_root

SRC="${1:-latest}"
if [[ "$SRC" == "latest" ]]; then
  SRC="$(ls -1dt "$BACKUP_DIR"/20* 2>/dev/null | head -n1)"
fi
[[ -d "$SRC" ]] || die "Backup directory not found: $SRC"
log "Restoring from: $SRC"

# Verify manifest if present
if [[ -f "$SRC/MANIFEST.sha256" ]]; then
  ( cd "$SRC" && sha256sum -c MANIFEST.sha256 >/dev/null 2>&1 ) && ok "Checksum OK" || warn "Checksum mismatch — continuing."
fi

# 1) Env file
if [[ -f "$SRC/.env.production" ]]; then
  cp -f "$SRC/.env.production" "$ENV_FILE"; chmod 600 "$ENV_FILE"; ok "Env restored."
fi
load_env

# Ensure DB container is up
cd "$DEPLOY_DIR"
docker compose --env-file "$ENV_FILE" -f docker-compose.supabase.yml up -d supabase-db
wait_for_supabase_db
ensure_supabase_core_roles

# 2) PostgreSQL
if [[ -f "$SRC/postgres-all.sql.gz" ]]; then
  warn "Restoring PostgreSQL cluster (existing data will be overwritten)…"
  gunzip -c "$SRC/postgres-all.sql.gz" | docker exec -i supabase-db psql -U "${POSTGRES_USER}" -d postgres
  ok "PostgreSQL restored."
fi

# 3) Storage
if [[ -f "$SRC/storage.tar.gz" ]]; then
  docker run --rm -v deploy_supabase-storage-data:/data -v "$SRC":/backup alpine \
    sh -c "rm -rf /data/* && tar xzf /backup/storage.tar.gz -C /data" && ok "Storage restored."
fi

# Bring everything back up
docker compose --env-file "$ENV_FILE" -f docker-compose.supabase.yml up -d
restart_supabase_platform_services
wait_for_supabase_platform_schemas
docker compose --env-file "$ENV_FILE" -f docker-compose.yml up -d
ok "Restore complete. Run health-check.sh to verify."
