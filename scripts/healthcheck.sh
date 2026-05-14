#!/usr/bin/env bash
# Quick health probes for all public surfaces.
set -e
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"

check() {
  local name="$1" url="$2"
  if curl -fsS --max-time 10 "$url" >/dev/null; then
    echo "  [ok]   $name → $url"
  else
    echo "  [FAIL] $name → $url"
    return 1
  fi
}

echo "[health] $(date -Iseconds)"
check "frontend"   "https://${DOMAIN}/"
check "api-health" "https://${API_SUB}/api/health"
echo "[health] all OK"
