#!/usr/bin/env bash
set -euo pipefail

# MK Baliadanga — Laravel backend bootstrap.
# Run from inside backend/ on host (or inside the app container after `docker compose up -d`).

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[mkb] .env created — edit credentials before running again."
fi

# Inside container we have composer; on host you may need: docker compose exec app bash -lc "scripts/setup.sh"
if [ -d vendor ]; then
  echo "[mkb] vendor/ present"
else
  composer install --no-interaction --prefer-dist
fi

php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link || true
php artisan config:cache
php artisan route:cache

echo "[mkb] Bootstrap complete. Admin: ${ADMIN_EMAIL:-admin@mkb.local}"
