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

# Docker Compose env_file exports APP_KEY at container start. If it was empty,
# Laravel will keep reading the empty process env even after .env is edited.
# Ensure .env has a key and export the same key before php-fpm/queue starts.
env_key="$(grep -E '^APP_KEY=base64:.+' .env 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
if [ -z "$env_key" ]; then
  env_key="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')"
  if grep -q '^APP_KEY=' .env 2>/dev/null; then
    sed -i "s|^APP_KEY=.*|APP_KEY=${env_key}|" .env
  else
    printf '\nAPP_KEY=%s\n' "$env_key" >> .env
  fi
fi
export APP_KEY="$env_key"

exec "$@"
