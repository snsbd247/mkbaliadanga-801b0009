#!/usr/bin/env bash
#
# update.sh — Pull latest code, run migrations, rebuild frontend, clear caches.
# Usage (as root or deploy user): bash deploy/vps/update.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/erp}"
DOMAIN="${DOMAIN:-mohammadkhani.com}"
BACKEND_DIR="$APP_DIR/erp-backend"

log() { echo -e "\n\033[1;34m==> $*\033[0m"; }

log "Pulling latest code"
cd "$APP_DIR"
git pull --ff-only

log "Backend: composer + migrate"
cd "$BACKEND_DIR"
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

log "Frontend: rebuild"
cd "$APP_DIR"
npm ci
echo "VITE_API_BASE_URL=https://${DOMAIN}/api" > .env.production.local
npm run build
rm -rf "$BACKEND_DIR/public/assets" 2>/dev/null || true
cp -r dist/* "$BACKEND_DIR/public/"

log "Fixing permissions & reloading"
chown -R www-data:www-data "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"
systemctl reload nginx php8.2-fpm

log "Update complete."
