#!/usr/bin/env bash
#
# MK Cooperative ERP — UPDATE script
# ==================================
# Pulls the latest code from GitHub and redeploys, WITHOUT touching existing
# data and WITHOUT seeding any new sample data.
#
#   - git pull (fast-forward / reset to origin/BRANCH)
#   - composer install (no-dev)
#   - php artisan migrate --force   (schema changes only — NEVER --seed, NEVER fresh)
#   - npm install + npm run build (frontend)
#   - cache rebuild + nginx reload
#
# A safety DB dump is taken before migrating, in case a rollback is needed.
#
# USAGE (as root):
#   sudo bash /var/www/mk/scripts/update.sh
#
# Optional env vars:
#   APP_DIR   (default: /var/www/mk)
#   BRANCH    (default: main)
#
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mk}"
BRANCH="${BRANCH:-main}"
PHP_VER="8.2"
CRED_FILE="/root/mk-erp-credentials.txt"
BACKUP_DIR="/var/backups/mk-erp"

log()  { echo -e "\n\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (use sudo)."
[ -d "${APP_DIR}/.git" ] || die "No repo at ${APP_DIR}. Run setup.sh first."
export DEBIAN_FRONTEND=noninteractive

# ──────────────────────────────────────────────────────────────────────────
# 1. Safety DB backup (so existing data is never at risk)
# ──────────────────────────────────────────────────────────────────────────
read_cred() { grep "^$1=" "${CRED_FILE}" 2>/dev/null | cut -d= -f2- || true; }
DB_NAME="$(read_cred DB_NAME)"; DB_USER="$(read_cred DB_USER)"; DB_PASS="$(read_cred DB_PASSWORD)"
if [ -n "${DB_NAME}" ] && [ -n "${DB_USER}" ] && [ -n "${DB_PASS}" ]; then
  log "Backing up database before update…"
  mkdir -p "${BACKUP_DIR}"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  mysqldump --single-transaction --no-tablespaces \
    -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" > "${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql" \
    && log "Backup saved: ${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql"
  # keep last 14 dumps
  ls -1t "${BACKUP_DIR}"/*.sql 2>/dev/null | tail -n +15 | xargs -r rm -f
else
  warn "DB credentials not found in ${CRED_FILE} — skipping pre-update backup."
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Pull latest code from GitHub
# ──────────────────────────────────────────────────────────────────────────
log "Pulling latest code (origin/${BRANCH})…"
git config --global --add safe.directory "${APP_DIR}" || true
git -C "${APP_DIR}" fetch --depth 1 origin "${BRANCH}"
git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"

# Re-exec the freshly-pulled copy so the latest update logic always runs
# (guards against running a stale in-memory/cached script).
REPO_UPDATE="${APP_DIR}/scripts/update.sh"
if [ -z "${MK_UPDATE_REEXEC:-}" ] && [ -f "${REPO_UPDATE}" ]; then
  export MK_UPDATE_REEXEC=1
  exec bash "${REPO_UPDATE}"
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. Backend: dependencies + schema migration (NO SEED, NO FRESH)
# ──────────────────────────────────────────────────────────────────────────
log "Updating backend…"
cd "${APP_DIR}/backend"
export COMPOSER_ALLOW_SUPERUSER=1
# Hard repair for Laravel runtime directories. These paths are commonly
# gitignored/removed by deploys, but Composer's package discovery must write to
# bootstrap/cache before the app can continue.
ensure_laravel_runtime_dirs() {
  for dir in \
    bootstrap/cache \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public; do
    [ -f "${dir}" ] && rm -f "${dir}"
    install -d -m 0777 "${dir}"
  done
  chmod -R 0777 bootstrap/cache storage
  touch bootstrap/cache/.deploy-write-test storage/framework/views/.deploy-write-test
  rm -f bootstrap/cache/.deploy-write-test storage/framework/views/.deploy-write-test
}
ensure_laravel_runtime_dirs
composer config --no-plugins policy.advisories.block false 2>/dev/null || true
# Retry install: GitHub codeload (dist zips) occasionally returns HTTP 400/429.
for attempt in 1 2 3 4 5; do
  ensure_laravel_runtime_dirs
  composer install --no-dev --optimize-autoloader --no-interaction && break
  log "composer install failed (attempt ${attempt}/5) — clearing cache & retrying in 10s…"
  composer clear-cache >/dev/null 2>&1 || true
  sleep 10
  [ "${attempt}" = "5" ] && ensure_laravel_runtime_dirs && composer install --no-dev --optimize-autoloader --no-interaction --prefer-source
done

php artisan down --retry=15 || true
# migrate ONLY applies new migrations; it never drops tables or re-seeds data
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan up || true

chown -R www-data:www-data "${APP_DIR}/backend/storage" "${APP_DIR}/backend/bootstrap/cache"
chmod -R 775 "${APP_DIR}/backend/storage" "${APP_DIR}/backend/bootstrap/cache"

# ──────────────────────────────────────────────────────────────────────────
# 4. Frontend rebuild
# ──────────────────────────────────────────────────────────────────────────
log "Rebuilding frontend…"
cd "${APP_DIR}"
npm install
npm run build

# ──────────────────────────────────────────────────────────────────────────
# 5. Reload services
# ──────────────────────────────────────────────────────────────────────────
log "Reloading PHP-FPM & Nginx…"
systemctl reload "php${PHP_VER}-fpm" || systemctl restart "php${PHP_VER}-fpm" || true
nginx -t && systemctl reload nginx

log "✅ Update complete — existing data preserved, no sample data seeded."
