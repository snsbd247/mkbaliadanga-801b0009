#!/usr/bin/env bash
# =============================================================================
# deploy/health-check.sh — verify PostgreSQL, Supabase, Coolify, Application.
# Exit 0 = all healthy, non-zero = at least one failure. Safe to run anytime.
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_env

FAIL=0
check() { # check <label> <command...>
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else err "$label"; FAIL=$((FAIL+1)); fi
}

log "Running health checks…"

# --- PostgreSQL ---
check "PostgreSQL ready" docker exec supabase-db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
check "PostgreSQL query" docker exec supabase-db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT 1"

# --- Supabase services (container running) ---
for svc in supabase-kong supabase-auth supabase-rest supabase-realtime supabase-storage supabase-meta supabase-studio supabase-functions; do
  check "Container $svc" sh -c "docker ps --format '{{.Names}}' | grep -q '^$svc\$'"
done

# --- Supabase API reachable through Kong ---
check "Supabase REST (Kong)" sh -c "docker exec supabase-kong sh -c 'curl -fsS -H \"apikey: ${ANON_KEY}\" http://localhost:8000/rest/v1/ >/dev/null'"
check "Supabase Auth health" sh -c "docker exec supabase-kong sh -c 'curl -fsS http://supabase-auth:9999/health >/dev/null'"

# --- Application ---
check "App container" sh -c "docker ps --format '{{.Names}}' | grep -q '^mk_app\$'"
check "App responds (Caddy)" sh -c "curl -fsS -o /dev/null https://${APP_DOMAIN} || curl -fsS -o /dev/null http://mk_app:80 2>/dev/null || docker exec mk_app wget -qO- http://localhost:80/ >/dev/null"

# --- Coolify ---
check "Coolify reachable" sh -c "curl -fsS -o /dev/null http://localhost:8000 || docker ps --format '{{.Names}}' | grep -q coolify"

# --- Edge functions runtime ---
check "Edge functions runtime" sh -c "docker exec supabase-functions sh -c 'curl -fsS http://localhost:9000/ >/dev/null' 2>/dev/null || docker ps --format '{{.Names}}' | grep -q '^supabase-functions\$'"

echo
if [[ $FAIL -eq 0 ]]; then ok "All systems healthy."; exit 0
else err "$FAIL check(s) failed."; exit 1; fi
