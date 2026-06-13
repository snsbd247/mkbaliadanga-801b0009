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
load_env() { [[ -f "$ENV_FILE" ]] && set -a && . "$ENV_FILE" && set +a || true; }
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
