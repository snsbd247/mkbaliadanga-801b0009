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

exec "$@"
