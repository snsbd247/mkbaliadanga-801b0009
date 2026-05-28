#!/usr/bin/env bash
# Quick health probes for all public surfaces + backend internals.
set +e
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"

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

echo "[health] $(date -Iseconds)"

for c in mkb_app mkb_postgres mkb_redis mkb_minio mkb_nginx; do check_container "$c"; done

if docker exec mkb_postgres pg_isready -U mkb_user -d mkbaliadanga >/dev/null 2>&1; then
  ok "postgres ready"
else bad "postgres not ready"; fi

if docker exec mkb_redis redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "redis ready"
else bad "redis not ready"; fi

if docker exec mkb_app test -w bootstrap/cache 2>/dev/null && docker exec mkb_app test -w storage 2>/dev/null; then
  ok "storage + bootstrap/cache writable"
else bad "storage / bootstrap/cache NOT writable"; fi

PENDING="$(docker exec mkb_app php artisan migrate:status 2>/dev/null | grep -c 'Pending' || echo 0)"
if [ "${PENDING:-0}" = "0" ]; then ok "no pending migrations"
else bad "${PENDING} pending migrations"; fi

check_http "frontend (http)"  "http://${DOMAIN}/"
check_http "frontend (https)" "https://${DOMAIN}/" || true
check_http "api-health"       "https://${API_SUB}/api/health" || \
  check_http "api-health (http)" "http://${API_SUB}/api/health"

if [ "$FAIL" = "0" ]; then echo "[health] all OK"; exit 0
else echo "[health] FAILURES detected"; exit 1; fi
