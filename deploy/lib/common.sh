#!/usr/bin/env bash
# =============================================================================
# deploy/lib/common.sh — shared helpers (logging, idempotency, secrets)
# Sourced by every script in deploy/. Not meant to be run directly.
# =============================================================================
set -Eeuo pipefail

# ---- Resolve paths ----------------------------------------------------------
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.production}"
LOG_DIR="${LOG_DIR:-/var/log/mkbaliadanga}"
STATE_DIR="${STATE_DIR:-/var/lib/mkbaliadanga}"
BACKUP_DIR="${BACKUP_DIR:-/opt/mkbaliadanga-backups}"

# ---- Colours / logging ------------------------------------------------------
if [[ -t 1 ]]; then C_RED=$'\e[31m'; C_GRN=$'\e[32m'; C_YEL=$'\e[33m'; C_BLU=$'\e[34m'; C_RST=$'\e[0m'
else C_RED=""; C_GRN=""; C_YEL=""; C_BLU=""; C_RST=""; fi

_ts() { date '+%Y-%m-%d %H:%M:%S'; }
_logfile() { mkdir -p "$LOG_DIR" 2>/dev/null || true; echo "$LOG_DIR/deploy.log"; }
log()  { echo "${C_BLU}[$(_ts)]${C_RST} $*"        | tee -a "$(_logfile)"; }
ok()   { echo "${C_GRN}[$(_ts)] ✓${C_RST} $*"      | tee -a "$(_logfile)"; }
warn() { echo "${C_YEL}[$(_ts)] ⚠${C_RST} $*"      | tee -a "$(_logfile)" >&2; }
err()  { echo "${C_RED}[$(_ts)] ✗${C_RST} $*"      | tee -a "$(_logfile)" >&2; }
die()  { err "$*"; exit 1; }

# ---- Error trap (rollback hook) --------------------------------------------
# Scripts may define `rollback()` to be invoked on failure.
on_error() {
  local code=$? line=${1:-?}
  err "Failed at line $line (exit $code)."
  if declare -F rollback >/dev/null; then warn "Running rollback…"; rollback || err "Rollback incomplete."; fi
  exit "$code"
}
trap 'on_error $LINENO' ERR

# ---- Idempotency helpers ----------------------------------------------------
need_root() { [[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0)."; }
have()      { command -v "$1" >/dev/null 2>&1; }
mark_done() { mkdir -p "$STATE_DIR"; touch "$STATE_DIR/.$1.done"; }
is_done()   { [[ -f "$STATE_DIR/.$1.done" ]]; }
step() { # step <name> <description> <command...>
  local name="$1" desc="$2"; shift 2
  if is_done "$name"; then ok "$desc (already done, skipping)"; return 0; fi
  log "$desc…"; "$@"; mark_done "$name"; ok "$desc"
}

# ---- .env helpers -----------------------------------------------------------
quote_env_values_with_spaces() {
  local file="${1:-$ENV_FILE}"
  [[ -f "$file" ]] || return 0
  # Old generated env files may contain unquoted values like MK Baliadanga,
  # sometimes with inline comments. Those break `source`/`. file` with
  # "command not found". Repair any KEY=value line whose unquoted value has
  # whitespace while preserving empty values and comments.
  if have python3; then
    python3 - "$file" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
out = []
changed = False
key_re = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")

for raw in text.splitlines(keepends=True):
    newline = "\n" if raw.endswith("\n") else ""
    line = raw[:-1] if newline else raw
    if line.endswith("\r"):
        line = line[:-1]
        newline = "\r" + newline

    m = key_re.match(line)
    if not m:
        out.append(raw)
        continue

    key, value = m.group(1), m.group(2)
    stripped = value.lstrip()
    if not stripped or stripped.startswith(("#", '"', "'")) or not re.search(r"\s", stripped):
        out.append(raw)
        continue

    body = value
    comment = ""
    comment_match = re.search(r"\s+#", body)
    if comment_match:
        comment = body[comment_match.start():]
        body = body[:comment_match.start()]

    body = body.strip()
    if body and re.search(r"\s", body):
        escaped = body.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$").replace("`", "\\`")
        out.append(f'{key}="{escaped}"{comment}{newline}')
        changed = True
    else:
        out.append(raw)

if changed:
    path.write_text("".join(out))
PY
  else
    sed -i -E "s|^([A-Za-z_][A-Za-z0-9_]*)=([^\"'#[:space:]][^\"'#]*[[:space:]][^\"'#]*)([[:space:]]+#.*)?$|\1=\"\2\"\3|" "$file"
  fi
}

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    quote_env_values_with_spaces "$ENV_FILE"
    set -a
    . "$ENV_FILE"
    set +a
  fi
}
gen_secret() { openssl rand -hex "${1:-32}"; }
gen_password() { openssl rand -base64 24 | tr -d '/+=' | head -c 24; }

# Base64url encode (for JWT) without trailing padding
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# Generate a Supabase-style HS256 JWT for role=anon|service_role
# usage: make_jwt <jwt_secret> <role> <iat> <exp>
make_jwt() {
  local secret="$1" role="$2" iat="$3" exp="$4"
  local header payload sig
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$role" "$iat" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" \
        | openssl dgst -binary -sha256 -hmac "$secret" | b64url)
  printf '%s.%s.%s' "$header" "$payload" "$sig"
}

# ---- Self-hosted Supabase DB bootstrap --------------------------------------
wait_for_supabase_db() {
  local tries="${1:-90}"
  log "Waiting for supabase-db…"
  for _ in $(seq 1 "$tries"); do
    if docker exec supabase-db pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" >/dev/null 2>&1; then
      ok "Database is ready."
      return 0
    fi
    sleep 2
  done
  die "Database did not become ready in time. Check: docker logs supabase-db"
}

wait_for_supabase_platform_schemas() {
  local tries="${1:-90}"
  log "Waiting for auth/storage platform schemas…"
  for _ in $(seq 1 "$tries"); do
    if docker exec supabase-db psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -tAc \
      "SELECT to_regclass('auth.users') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL" 2>/dev/null | grep -q t; then
      ok "Platform schemas are ready."
      return 0
    fi
    sleep 2
  done
  log "----- supabase-auth (last 40 lines) -----";    docker logs --tail 40 supabase-auth    2>&1 || true
  log "----- supabase-storage (last 40 lines) -----"; docker logs --tail 40 supabase-storage 2>&1 || true
  log "----- supabase-rest (last 40 lines) -----";    docker logs --tail 40 supabase-rest    2>&1 || true
  die "Auth/storage schemas did not become ready. Check: docker logs supabase-auth supabase-storage supabase-rest"
}

ensure_supabase_core_roles() {
  log "Ensuring self-hosted database roles exist…"
  docker exec -i supabase-db psql -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" \
    -v db="${POSTGRES_DB:-postgres}" <<'SQL'
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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    CREATE ROLE supabase_functions_admin LOGIN NOINHERIT CREATEROLE BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin LOGIN NOINHERIT CREATEROLE BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    CREATE ROLE pgbouncer LOGIN NOINHERIT;
  END IF;
END$$;
SQL

  docker exec -i supabase-db psql -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" \
    -v db="${POSTGRES_DB:-postgres}" -v pgpass="${POSTGRES_PASSWORD}" <<'SQL'

ALTER ROLE service_role BYPASSRLS;
ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD :'pgpass';
ALTER ROLE supabase_admin WITH LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD :'pgpass';
ALTER ROLE supabase_auth_admin WITH LOGIN NOINHERIT CREATEROLE BYPASSRLS PASSWORD :'pgpass';
ALTER ROLE supabase_storage_admin WITH LOGIN NOINHERIT CREATEROLE BYPASSRLS PASSWORD :'pgpass';
ALTER ROLE supabase_functions_admin WITH LOGIN NOINHERIT CREATEROLE BYPASSRLS PASSWORD :'pgpass';
ALTER ROLE supabase_realtime_admin WITH LOGIN NOINHERIT CREATEROLE BYPASSRLS PASSWORD :'pgpass';
ALTER ROLE pgbouncer WITH LOGIN NOINHERIT PASSWORD :'pgpass';

GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL PRIVILEGES ON DATABASE :"db" TO supabase_admin;
GRANT CREATE ON DATABASE :"db" TO supabase_auth_admin, supabase_storage_admin, supabase_functions_admin, supabase_realtime_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Pre-create platform schemas owned by their admin roles so GoTrue/Storage
-- migrations have a schema to write into (required on self-hosted Postgres).
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
SQL
  ok "Self-hosted database roles are ready."
}
