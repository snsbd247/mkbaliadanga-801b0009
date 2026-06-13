#!/usr/bin/env bash
# ==============================================================================
# Lovable Cloud → Self-hosted Supabase Restore Script
# ==============================================================================
# Downloads a database dump from the `db-export` Edge Function and restores it
# into the Dockerized Postgres container running on the VPS.
#
# Usage on the VPS (as root or sudo):
#   ./scripts/restore-vps.sh [--mode data|schema|full] [--file backup.sql]
#
# Required env vars (or pass on command line):
#   SUPABASE_URL      source backend URL, e.g. https://supabase.yourdomain.com
#   CRON_SECRET       same value stored as Edge Function secret in Lovable Cloud
#
# Options:
#   --mode <m>        data (default) | schema | full
#   --file <path>     use a local .sql file instead of downloading
#   --no-truncate     skip wiping existing data before restore
#   --container <n>   docker container name (default: supabase-db)
#   --db <name>       database name (default: postgres)
#   --user <name>     postgres user (default: postgres)
#   -h, --help        show this help
# ==============================================================================

set -euo pipefail

# Defaults
MODE="data"
FILE=""
CONTAINER="supabase-db"
DB_NAME="postgres"
DB_USER="postgres"
NO_TRUNCATE=0
SUPABASE_URL="${SUPABASE_URL:-}"
CRON_SECRET="${CRON_SECRET:-}"

# Colors
R="\033[0;31m"; G="\033[0;32m"; Y="\033[1;33m"; B="\033[0;34m"; N="\033[0m"
log()  { echo -e "${B}[*]${N} $*"; }
ok()   { echo -e "${G}[✓]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }
err()  { echo -e "${R}[✗]${N} $*" >&2; }

usage() { sed -n '2,30p' "$0"; exit 0; }

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)        MODE="$2"; shift 2 ;;
    --file)        FILE="$2"; shift 2 ;;
    --container)   CONTAINER="$2"; shift 2 ;;
    --db)          DB_NAME="$2"; shift 2 ;;
    --user)        DB_USER="$2"; shift 2 ;;
    --no-truncate) NO_TRUNCATE=1; shift ;;
    -h|--help)     usage ;;
    *) err "Unknown arg: $1"; exit 1 ;;
  esac
done

# Validation
if [[ -z "$FILE" ]]; then
  if [[ -z "$CRON_SECRET" ]]; then
    err "CRON_SECRET env var is required to download backup."
    err "Either: export CRON_SECRET=... OR pass --file backup.sql"
    exit 1
  fi
  if [[ -z "$SUPABASE_URL" ]]; then
    err "SUPABASE_URL env var is required to download backup."
    err "Example: export SUPABASE_URL=https://supabase.yourdomain.com"
    exit 1
  fi
  if [[ ! "$MODE" =~ ^(data|schema|full)$ ]]; then
    err "Invalid mode: $MODE (must be data|schema|full)"; exit 1
  fi
fi

# Check container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  err "Container '${CONTAINER}' is not running."
  err "Run from supabase-project dir: docker compose up -d"
  exit 1
fi
ok "Container '${CONTAINER}' is running"

# Step 1: Download backup if not provided
if [[ -z "$FILE" ]]; then
  TS=$(date +%Y%m%d-%H%M%S)
  FILE="/tmp/lovable-backup-${TS}.sql"
  log "Downloading backup (mode=${MODE})..."
  log "URL: ${SUPABASE_URL}/functions/v1/db-export?mode=${MODE}"

  HTTP_CODE=$(curl -sS -o "$FILE" -w "%{http_code}" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    "${SUPABASE_URL}/functions/v1/db-export?mode=${MODE}")

  if [[ "$HTTP_CODE" != "200" ]]; then
    err "Download failed (HTTP ${HTTP_CODE})"
    err "Response: $(head -c 500 "$FILE")"
    rm -f "$FILE"
    exit 1
  fi

  SIZE=$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE")
  ok "Downloaded $(numfmt --to=iec ${SIZE} 2>/dev/null || echo "${SIZE} bytes") → $FILE"
fi

if [[ ! -s "$FILE" ]]; then
  err "Backup file is empty or missing: $FILE"; exit 1
fi

# Step 2: Confirm
echo ""
warn "==============================================="
warn "  ABOUT TO RESTORE INTO LIVE DATABASE"
warn "==============================================="
warn "  Container : ${CONTAINER}"
warn "  Database  : ${DB_NAME}"
warn "  File      : ${FILE} ($(wc -l < "$FILE") lines)"
warn "  Mode      : ${MODE}"
warn "  Truncate  : $([ $NO_TRUNCATE -eq 1 ] && echo no || echo YES (existing data will be wiped))"
warn "==============================================="
read -r -p "Proceed? (yes/NO): " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { warn "Aborted."; exit 0; }

# Step 3: Copy into container
log "Copying SQL into container..."
docker cp "$FILE" "${CONTAINER}:/tmp/restore.sql"
ok "Copied"

# Step 4: Restore
log "Running restore..."
START=$(date +%s)

if docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
     -v ON_ERROR_STOP=1 -f /tmp/restore.sql > /tmp/restore.log 2>&1; then
  DUR=$(( $(date +%s) - START ))
  ok "Restore completed in ${DUR}s"
else
  err "Restore failed. Last 50 lines of log:"
  tail -n 50 /tmp/restore.log >&2
  exit 1
fi

# Step 5: Cleanup + restart dependent services
docker exec "$CONTAINER" rm -f /tmp/restore.sql
log "Restarting dependent services..."
( cd /home/mkadmin/supabase-project 2>/dev/null && \
  docker compose restart rest auth storage realtime 2>&1 | tail -5 ) || \
  warn "Could not auto-restart services. Run manually: docker compose restart rest auth storage realtime"

ok "Done! Test your app at https://mohammadkhani.com"
echo ""
log "Quick verify:"
echo "  docker exec -it ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c \"\\dt public.*\""
