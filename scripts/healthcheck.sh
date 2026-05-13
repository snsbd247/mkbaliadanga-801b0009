#!/usr/bin/env bash
# Quick health probes for all public surfaces.
set -e
DOMAIN="${DOMAIN:-mohammadkhani.com}"

check() {
  local name="$1" url="$2"
  if curl -fsS --max-time 10 "$url" >/dev/null; then
    echo "  [ok] $name"
  else
    echo "  [FAIL] $name → $url"
    return 1
  fi
}

echo "[health] $(date -Iseconds)"
check "frontend" "https://${DOMAIN}/"
check "api"      "https://api.${DOMAIN}/health"
check "minio"    "https://files.${DOMAIN}/minio/health/ready"
echo "[health] all OK"
