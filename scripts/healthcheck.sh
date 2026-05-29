#!/usr/bin/env bash
# Quick health probes for all public surfaces + backend internals.
set +e
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/backend/.env}"

FAIL=0
ok()  { echo "  [ok]   $*"; }
bad() { echo "  [FAIL] $*"; FAIL=1; }

check_http() {
  local name="$1" url="$2"
  if curl -fsS --max-time 10 "$url" >/dev/null 2>&1; then ok "$name → $url"
  else bad "$name → $url"; fi
}
check_container() {
  local name="$1"
  if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then ok "container $name up"
  else bad "container $name NOT running"; fi
}
env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//'
}

echo "[health] $(date -Iseconds)"

for c in mkb_app mkb_postgres mkb_redis mkb_minio mkb_nginx; do check_container "$c"; done

if docker exec mkb_postgres pg_isready -U mkb_user -d mkbaliadanga >/dev/null 2>&1; then
  ok "postgres ready"
else bad "postgres not ready"; fi

REDIS_PASSWORD="$(env_value REDIS_PASSWORD)"
if [ -n "$REDIS_PASSWORD" ] && docker exec mkb_redis redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG; then
  ok "redis ready"
elif [ -z "$REDIS_PASSWORD" ] && docker exec mkb_redis redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "redis ready"
else bad "redis not ready"; fi

if docker exec mkb_app test -w bootstrap/cache 2>/dev/null && docker exec mkb_app test -w storage 2>/dev/null; then
  ok "storage + bootstrap/cache writable"
else bad "storage / bootstrap/cache NOT writable"; fi

if docker exec mkb_app php artisan tinker --execute="encrypt('test')" >/dev/null 2>&1; then
  ok "Laravel APP_KEY/encryption valid (encrypt('test') succeeded)"
else bad "Laravel APP_KEY/encryption invalid (encrypt('test') failed)"; fi

MIGRATE_STATUS="$(docker exec mkb_app php artisan migrate:status 2>/dev/null)"
if [ "$?" != "0" ]; then
  bad "could not read migration status"
else
  PENDING="$(printf '%s\n' "$MIGRATE_STATUS" | awk '/Pending/{c++} END{print c+0}')"
  if [ "${PENDING:-0}" = "0" ]; then ok "no pending migrations"
  else bad "${PENDING} pending migrations"; fi
fi

check_http "frontend (http)"  "http://${DOMAIN}/"
check_http "frontend (https)" "https://${DOMAIN}/" || true
check_http "api-health"       "https://${API_SUB}/api/health" || \
  check_http "api-health (http)" "http://${API_SUB}/api/health"

if [ "$FAIL" = "0" ]; then echo "[health] all OK"; exit 0
else echo "[health] FAILURES detected"; exit 1; fi
