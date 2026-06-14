#!/usr/bin/env bash
# =============================================================================
# deploy/migrate.sh — import existing Supabase schema/RLS/triggers/functions/
# indexes/seed into the self-hosted PostgreSQL. Idempotent + tracked.
#
# Source of truth: <repo>/supabase/migrations/*.sql  (and optional seed.sql)
# Applied migrations are tracked in public.schema_migrations so re-runs are safe.
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_env

REPO_MIGRATIONS="$ROOT_DIR/supabase/migrations"
LOCAL_MIGRATIONS="$DEPLOY_DIR/supabase/migrations"
SEED_FILE="$ROOT_DIR/supabase/seed.sql"

psql_db() { docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" "$@"; }

ensure_authenticator_role() {
  psql_db -q <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END$$;

ALTER ROLE service_role BYPASSRLS;
GRANT anon, authenticated, service_role TO authenticator;
SQL
}

sync_migrations() {
  mkdir -p "$LOCAL_MIGRATIONS"
  if [[ -d "$REPO_MIGRATIONS" ]]; then
    log "Detecting repo migrations in $REPO_MIGRATIONS"
    rsync -a --delete "$REPO_MIGRATIONS/" "$LOCAL_MIGRATIONS/" 2>/dev/null \
      || cp -f "$REPO_MIGRATIONS"/*.sql "$LOCAL_MIGRATIONS/" 2>/dev/null || true
    ok "Found $(ls -1 "$LOCAL_MIGRATIONS"/*.sql 2>/dev/null | wc -l) migration file(s)."
  else
    warn "No repo migrations directory found ($REPO_MIGRATIONS)."
  fi
}

ensure_tracking() {
  psql_db -q <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
}

configure_runtime_settings() {
  log "Configuring environment-specific database runtime settings…"
  ensure_authenticator_role
  psql_db -q -v db="${POSTGRES_DB}" -v supabase_url="${VITE_SUPABASE_URL}" -v anon_key="${ANON_KEY}" -v jwt_secret="${JWT_SECRET}" <<'SQL'
ALTER DATABASE :"db" SET app.supabase_url = :'supabase_url';
ALTER DATABASE :"db" SET app.supabase_anon_key = :'anon_key';
ALTER DATABASE :"db" SET app.settings.jwt_secret = :'jwt_secret';
ALTER DATABASE :"db" SET app.settings.jwt_exp = '3600';
ALTER ROLE authenticator IN DATABASE :"db" SET app.supabase_url = :'supabase_url';
ALTER ROLE authenticator IN DATABASE :"db" SET app.supabase_anon_key = :'anon_key';
SQL
  ok "Database runtime settings now point to this environment."

}

apply_all() {
  local applied=0 skipped=0
  shopt -s nullglob
  for f in $(ls -1 "$LOCAL_MIGRATIONS"/*.sql 2>/dev/null | sort); do
    local ver; ver="$(basename "$f")"
    if psql_db -tAc "SELECT 1 FROM public.schema_migrations WHERE version='${ver}'" | grep -q 1; then
      skipped=$((skipped+1)); continue
    fi
    log "Applying migration: $ver (schema, RLS, triggers, functions, indexes)…"
    # Each migration runs inside a single transaction; tracked on success.
    docker exec -i supabase-db psql -v ON_ERROR_STOP=1 --single-transaction \
      -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "$f"
    psql_db -q -c "INSERT INTO public.schema_migrations(version) VALUES ('${ver}') ON CONFLICT DO NOTHING;"
    applied=$((applied+1)); ok "Applied $ver"
  done
  ok "Migrations complete: $applied applied, $skipped already present."
}

apply_seed() {
  if [[ -f "$SEED_FILE" ]]; then
    log "Importing seed data ($SEED_FILE)…"
    docker exec -i supabase-db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "$SEED_FILE" || warn "Seed import had warnings."
    ok "Seed data imported."
  else
    log "No seed.sql found — skipping seed import."
  fi
}

main() {
  wait_for_supabase_db
  ensure_supabase_core_roles
  restart_supabase_platform_services
  wait_for_supabase_platform_schemas
  sync_migrations
  ensure_tracking
  configure_runtime_settings
  apply_all
  apply_seed
  ok "Database migration finished."
}
main "$@"
