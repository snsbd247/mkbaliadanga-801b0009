#!/bin/sh
# Laravel runtime bootstrap — guarantees writable dirs exist even when the
# host directory is bind-mounted over /var/www/html (which hides what the
# Dockerfile created at build time).
set -e

cd /var/www/html

mkdir -p \
  bootstrap/cache \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/framework/testing \
  storage/logs \
  storage/app/public

# Best-effort ownership + permissions (ignore failures on read-only mounts).
chown -R www-data:www-data bootstrap/cache storage 2>/dev/null || true
chmod -R 775 bootstrap/cache storage 2>/dev/null || true

# Docker Compose env_file exports APP_KEY at container start. If that value is
# empty or malformed, Laravel keeps reading the bad process env. Validate the
# base64 payload decodes to exactly 32 bytes, then export the known-good key.
is_valid_laravel_key() {
  key="${1:-}"
  tmp_key_file="/tmp/mkb_app_key_check.$$"
  case "$key" in base64:*) ;; *) return 1 ;; esac
  payload="${key#base64:}"
  [ -n "$payload" ] || return 1
  printf '%s' "$payload" | base64 -d > "$tmp_key_file" 2>/dev/null || { rm -f "$tmp_key_file"; return 1; }
  decoded_len="$(wc -c < "$tmp_key_file" | tr -d '[:space:]')"
  rm -f "$tmp_key_file"
  [ "$decoded_len" = "32" ]
}

env_key="$(grep -E '^APP_KEY=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
if ! is_valid_laravel_key "$env_key"; then
  env_key="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')"
  if grep -q '^APP_KEY=' .env 2>/dev/null; then
    sed -i "s|^APP_KEY=.*|APP_KEY=${env_key}|" .env
  else
    printf '\nAPP_KEY=%s\n' "$env_key" >> .env
  fi
fi
export APP_KEY="$env_key"

exec "$@"
