#!/usr/bin/env bash
#
# update.sh — Safe deploy with automatic backup + rollback on failure.
# Pulls latest code, backs up DB + current release, runs migrations,
# rebuilds frontend. If any step fails, it restores the pre-deploy state.
#
# Usage (as root or deploy user): bash deploy/vps/update.sh
# Manual rollback to last backup:  bash deploy/vps/update.sh --rollback
#
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/erp}"
DOMAIN="${DOMAIN:-mohammadkhani.com}"
BACKEND_DIR="$APP_DIR/erp-backend"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp}"
TS="$(date +%Y%m%d_%H%M%S)"

DB_CONNECTION="${DB_CONNECTION:-mysql}"
DB_DATABASE="${DB_DATABASE:-mohammadkhani}"
DB_USERNAME="${DB_USERNAME:-mkb_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"

log()  { echo -e "\n\033[1;34m==> $*\033[0m"; }
err()  { echo -e "\n\033[1;31m✘ $*\033[0m" >&2; }
ok()   { echo -e "\033[1;32m✔ $*\033[0m"; }

mkdir -p "$BACKUP_DIR"

dump_db() {
  local out="$1"
  log "Backing up database → $out"
  mysqldump --single-transaction --quick --routines --triggers \
    -h "$DB_HOST" -u "$DB_USERNAME" ${DB_PASSWORD:+-p"$DB_PASSWORD"} \
    "$DB_DATABASE" | gzip > "$out"
}

restore_db() {
  local in="$1"
  err "Restoring database from $in"
  gunzip -c "$in" | mysql -h "$DB_HOST" -u "$DB_USERNAME" ${DB_PASSWORD:+-p"$DB_PASSWORD"} "$DB_DATABASE"
}

# ---------- Manual rollback ----------
if [[ "${1:-}" == "--rollback" ]]; then
  LAST_SQL="$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1 || true)"
  LAST_GIT="$(cat "$BACKUP_DIR/last_commit.txt" 2>/dev/null || true)"
  [[ -z "$LAST_SQL" ]] && { err "No DB backup found in $BACKUP_DIR"; exit 1; }
  [[ -n "$LAST_GIT" ]] && { cd "$APP_DIR"; git reset --hard "$LAST_GIT"; }
  restore_db "$LAST_SQL"
  cd "$BACKEND_DIR" && composer install --no-dev --optimize-autoloader && php artisan optimize:clear
  cd "$APP_DIR" && npm ci && npm run build && cp -r dist/* "$BACKEND_DIR/public/"
  systemctl reload nginx php8.2-fpm
  ok "Rollback complete (commit ${LAST_GIT:-unknown})."
  exit 0
fi

# ---------- Pre-deploy backup ----------
cd "$APP_DIR"
PREV_COMMIT="$(git rev-parse HEAD)"
echo "$PREV_COMMIT" > "$BACKUP_DIR/last_commit.txt"
DB_BACKUP="$BACKUP_DIR/db_${TS}.sql.gz"
dump_db "$DB_BACKUP"

# ---------- Rollback trap ----------
rollback() {
  err "Deploy failed — rolling back to $PREV_COMMIT"
  cd "$APP_DIR" && git reset --hard "$PREV_COMMIT" || true
  restore_db "$DB_BACKUP" || true
  cd "$BACKEND_DIR" && php artisan optimize:clear || true
  systemctl reload nginx php8.2-fpm || true
  err "Rolled back. Investigate logs: $BACKEND_DIR/storage/logs/laravel.log"
  exit 1
}
trap rollback ERR

# ---------- Deploy ----------
log "Pulling latest code"
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

# ---------- Post-deploy smoke check (auto-rollback if it fails) ----------
log "Post-deploy health-check"
if command -v node >/dev/null && [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  API_URL="https://${DOMAIN}/api" ADMIN_USER="${ADMIN_USER:-ismail162}" \
    ADMIN_PASSWORD="$ADMIN_PASSWORD" node "$APP_DIR/scripts/api-healthcheck.mjs"
else
  curl -fsS -o /dev/null "https://${DOMAIN}" || curl -fsS -o /dev/null "http://127.0.0.1"
fi

trap - ERR
# Keep only the 10 newest DB backups
ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

ok "Update complete. Backup kept at $DB_BACKUP"
