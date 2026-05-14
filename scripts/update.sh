#!/usr/bin/env bash
# Update MK Baliadanga to latest main branch (Laravel backend + Vite frontend).
set -euo pipefail
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/mkbaliadanga}"
WEB_ROOT="${WEB_ROOT:-/var/www/${DOMAIN}}"

cd "$APP_DIR"

echo "[mk] Pulling latest code..."
git config --global --add safe.directory "$APP_DIR" || true
sudo -u "$APP_USER" git fetch --all
sudo -u "$APP_USER" git reset --hard origin/main

echo "[mk] Rebuilding backend containers..."
cd "$APP_DIR/backend"
sudo -u "$APP_USER" docker compose pull || true
sudo -u "$APP_USER" docker compose up -d --build

echo "[mk] Running pending migrations + cache refresh..."
docker exec mkb_app composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader || true
docker exec mkb_app php artisan migrate --force
docker exec mkb_app php artisan db:seed --class=AdminUserSeeder --force || true
docker exec mkb_app php artisan config:cache
docker exec mkb_app php artisan route:cache
docker exec mkb_app php artisan queue:restart || true

echo "[mk] Rebuilding frontend → ${WEB_ROOT}"
cd "$APP_DIR"
sudo -u "$APP_USER" VITE_API_URL="https://${API_SUB}/api" VITE_BACKEND="laravel" VITE_USE_API="1" \
  bash -lc "npm ci && npm run build"
rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

systemctl reload nginx || true

echo "[mk] Update complete."
bash "$APP_DIR/scripts/healthcheck.sh" || true
