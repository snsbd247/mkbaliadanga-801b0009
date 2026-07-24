#!/usr/bin/env bash
#
# MK Cooperative ERP — UPDATE script (cPanel / shared hosting via SSH)
# =====================================================================
# Same safety goals as scripts/update.sh (the VPS/root version), adapted for a
# cPanel account reached over plain SSH — no root, no systemctl, no sudoers,
# no Nginx. Pulls the latest code from GitHub and redeploys, WITHOUT touching
# existing data and WITHOUT seeding any new sample data.
#
#   - git pull (fast-forward / reset to origin/BRANCH)
#   - composer install (no-dev)
#   - php artisan migrate --force   (schema changes only — NEVER --seed, NEVER fresh)
#   - npm install + npm run build (frontend)
#   - Laravel cache rebuild
#   - refresh the SPA .htaccess (Apache has no reload step to run)
#
# A safety DB dump is taken before migrating, in case a rollback is needed.
# Credentials are read straight out of backend/.env — there is no root-only
# credentials file on shared hosting.
#
# USAGE (as the cPanel user, over SSH):
#   bash ~/mk_erp/scripts/update-cpanel.sh
#
# Optional env vars:
#   APP_DIR    (default: directory this script lives in, one level up)
#   BRANCH     (default: main)
#   DOC_ROOT   (default: ${APP_DIR}/public_html — the folder cPanel serves the
#              domain from; only used to (re)write the SPA .htaccess. Leave
#              unset if you deploy the frontend elsewhere.)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "${SCRIPT_DIR}")}"
BRANCH="${BRANCH:-main}"
DOC_ROOT="${DOC_ROOT:-${APP_DIR}/public_html}"
BACKUP_DIR="${APP_DIR}/backups"

log()  { echo -e "\n\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m" >&2; exit 1; }

[ -d "${APP_DIR}/.git" ] || die "No repo at ${APP_DIR}. Clone it first: git clone -b ${BRANCH} <repo-url> ${APP_DIR}"

# ── Dry-run mode ───────────────────────────────────────────────────────────
DRY_RUN="${MK_DRY_RUN:-0}"
NO_SEED="${MK_NO_SEED:-0}"
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=1 ;;
    --no-seed) NO_SEED=1 ;;
  esac
done
export MK_NO_SEED="${NO_SEED}"

FS_READONLY=0
if ! (touch "${APP_DIR}/.mk-write-test" 2>/dev/null && rm -f "${APP_DIR}/.mk-write-test" 2>/dev/null); then
  FS_READONLY=1
fi

if [ "${DRY_RUN}" = "1" ]; then
  log "DRY-RUN: validation only — no files will be changed."
  BRANCH_NOW="$(git -C "${APP_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  log "  • branch: ${BRANCH_NOW} (target: ${BRANCH})"
  if git -C "${APP_DIR}" diff --quiet 2>/dev/null; then
    log "  • working tree: clean"
  else
    warn "  • working tree: has local changes (will be reset by real deploy)"
  fi
  [ "${FS_READONLY}" = "1" ] && warn "  • project filesystem: READ-ONLY" || log "  • project filesystem: writable"
  for bin in git php composer npm; do
    command -v "$bin" >/dev/null 2>&1 && log "  • command ${bin}: $(command -v "$bin")" || warn "  • command ${bin}: MISSING"
  done
  df -h "${APP_DIR}" 2>/dev/null | tail -n1 | awk '{print "  • disk free on "$6": "$4" ("$5" used)"}'
  log "✅ DRY-RUN complete — no changes made."
  exit 0
fi

# Print the exact failing command + exit code so it's obvious what broke.
FAILED_CMD=""
capture_failed_cmd() { FAILED_CMD="$BASH_COMMAND"; }
trap 'capture_failed_cmd' DEBUG

ORIGINAL_HEAD="$(git -C "${APP_DIR}" rev-parse HEAD 2>/dev/null || true)"
rollback_on_error() {
  local status=$?
  trap - ERR DEBUG
  [ "${status}" -eq 0 ] && return 0

  echo -e "\033[1;31m[x] Deploy FAILED — exit code ${status}\033[0m" >&2
  [ -n "${FAILED_CMD:-}" ] && echo -e "\033[1;31m[x] Failing command: ${FAILED_CMD}\033[0m" >&2

  if [ -n "${ORIGINAL_HEAD}" ]; then
    local current_head
    current_head="$(git -C "${APP_DIR}" rev-parse HEAD 2>/dev/null || true)"
    if [ -n "${current_head}" ] && [ "${current_head}" != "${ORIGINAL_HEAD}" ]; then
      warn "Deploy failed — auto rollback to ${ORIGINAL_HEAD}…"
      rm -f "${APP_DIR}/.git/index.lock" 2>/dev/null || true
      git -C "${APP_DIR}" reset --hard "${ORIGINAL_HEAD}" || warn "Rollback git reset failed."
      if [ -d "${APP_DIR}/backend" ]; then
        (cd "${APP_DIR}/backend" && php artisan up >/dev/null 2>&1) || true
      fi
    else
      warn "Deploy failed before changing git HEAD — rollback not needed."
    fi
  else
    warn "Deploy failed and previous release commit could not be detected."
  fi
  exit "${status}"
}
trap rollback_on_error ERR

# ──────────────────────────────────────────────────────────────────────────
# 1. Safety DB backup (so existing data is never at risk)
# ──────────────────────────────────────────────────────────────────────────
if [ -f "${APP_DIR}/backend/.env" ]; then
  read_env() { grep "^$1=" "${APP_DIR}/backend/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"'' || true; }
  DB_NAME="$(read_env DB_DATABASE)"; DB_USER="$(read_env DB_USERNAME)"; DB_PASS="$(read_env DB_PASSWORD)"
else
  DB_NAME=""; DB_USER=""; DB_PASS=""
fi
if [ -n "${DB_NAME}" ] && [ -n "${DB_USER}" ]; then
  log "Backing up database before update…"
  mkdir -p "${BACKUP_DIR}"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  if [ -n "${DB_PASS}" ]; then
    mysqldump --single-transaction --no-tablespaces -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" > "${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql" \
      && log "Backup saved: ${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql"
  else
    mysqldump --single-transaction --no-tablespaces -u "${DB_USER}" "${DB_NAME}" > "${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql" \
      && log "Backup saved: ${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql"
  fi
  # keep last 14 dumps
  ls -1t "${BACKUP_DIR}"/*.sql 2>/dev/null | tail -n +15 | xargs -r rm -f
else
  warn "DB credentials not found in backend/.env — skipping pre-update backup."
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Pull latest code from GitHub
# ──────────────────────────────────────────────────────────────────────────
log "Pulling latest code (origin/${BRANCH})…"

fetch_with_retry() {
  local attempts=5 delay=5 i
  for i in $(seq 1 "${attempts}"); do
    if git -C "${APP_DIR}" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 \
         fetch --depth 1 origin "${BRANCH}"; then
      return 0
    fi
    warn "git fetch attempt ${i}/${attempts} failed (network?). Retrying in ${delay}s…"
    sleep "${delay}"
    delay=$(( delay * 2 ))
  done
  die "git fetch failed after ${attempts} attempts — check network/GitHub connectivity. No files were changed."
}
fetch_with_retry

log "Cleaning generated cache/lock files that can block pull…"
rm -f "${APP_DIR}/backend/bootstrap/cache/packages.php" \
      "${APP_DIR}/backend/bootstrap/cache/services.php" \
      "${APP_DIR}/backend/composer.lock" 2>/dev/null || true
git -C "${APP_DIR}" clean -fd -- backend/bootstrap/cache 2>/dev/null || true

git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"

# Re-exec the freshly-pulled copy so the latest update logic always runs.
REPO_UPDATE="${APP_DIR}/scripts/update-cpanel.sh"
if [ -z "${MK_UPDATE_REEXEC:-}" ] && [ -f "${REPO_UPDATE}" ]; then
  export MK_UPDATE_REEXEC=1
  exec bash "${REPO_UPDATE}"
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. Backend: dependencies + schema migration (NO SEED, NO FRESH)
# ──────────────────────────────────────────────────────────────────────────
log "Updating backend…"
cd "${APP_DIR}/backend"

ensure_laravel_runtime_dirs() {
  for dir in \
    bootstrap/cache \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public; do
    [ -f "${dir}" ] && rm -f "${dir}"
    mkdir -p "${dir}"
  done
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
if [ -f .env ]; then
  sed -i 's/^CACHE_STORE=.*/CACHE_STORE=file/; s/^SESSION_DRIVER=.*/SESSION_DRIVER=file/' .env
  grep -q '^CACHE_STORE=' .env || echo 'CACHE_STORE=file' >> .env
  grep -q '^SESSION_DRIVER=' .env || echo 'SESSION_DRIVER=file' >> .env
  log "  ✓ ensured CACHE_STORE=file / SESSION_DRIVER=file in .env"
fi
# migrate ONLY applies new migrations; it never drops tables or re-seeds data
log "Applying new migrations (schema only — no data drop, no sample seed)…"
log "  → running: php artisan migrate --force"
php artisan migrate --force
log "  ✓ migrations applied; ⏭  sample data seeders intentionally skipped on update"

if [ "${NO_SEED}" = "1" ]; then
  warn "--no-seed: skipping permission/admin seeders and admin auto-repair (accounts untouched)."
else
  log "Ensuring permissions + required admin accounts (idempotent)…"
  log "  → running: php artisan db:seed --class=PermissionsSeeder"
  php artisan db:seed --class=Database\\Seeders\\PermissionsSeeder --force && log "  ✓ PermissionsSeeder ok" || warn "  ✗ PermissionsSeeder failed"
  log "  → running: php artisan db:seed --class=SuperAdminSeeder"
  php artisan db:seed --class=Database\\Seeders\\SuperAdminSeeder --force && log "  ✓ SuperAdminSeeder ok" || warn "  ✗ SuperAdminSeeder failed"
  log "Verifying required admin accounts (developer + super_admin)…"
  php artisan admin:verify --fix || warn "  ✗ admin verification reported problems — check output above"
fi
php artisan config:clear; php artisan route:clear; php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan storage:link --force 2>/dev/null || php artisan storage:link || warn "  ✗ storage:link failed"

php artisan up || true

# ──────────────────────────────────────────────────────────────────────────
# 4. Frontend rebuild
# ──────────────────────────────────────────────────────────────────────────
log "Rebuilding frontend…"
cd "${APP_DIR}"
npm install
log "  → running: npm audit fix"
npm audit fix || warn "  ✗ npm audit fix reported problems — continuing"
npm run build

# If the built site is served from a separate cPanel document root, sync it.
if [ -d "${DOC_ROOT}" ] && [ "${DOC_ROOT}" != "${APP_DIR}/dist" ]; then
  log "Publishing dist/ → ${DOC_ROOT} …"
  # Keep API-related paths (e.g. a symlinked backend/public under the doc root)
  # untouched; only replace the SPA's own files.
  find "${DOC_ROOT}" -mindepth 1 -maxdepth 1 ! -name '.htaccess' ! -name 'api' ! -name 'storage' -exec rm -rf {} +
  cp -r "${APP_DIR}/dist/." "${DOC_ROOT}/"
fi

# SPA fallback + no server config to reload on cPanel — an .htaccess does the
# job Nginx's `try_files` does on the VPS build.
HTACCESS_TARGET="${DOC_ROOT}/.htaccess"
if [ -d "${DOC_ROOT}" ]; then
  log "Writing SPA .htaccess at ${HTACCESS_TARGET} …"
  cat > "${HTACCESS_TARGET}" <<'HTACCESS'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Leave API and uploaded-storage requests alone (proxied/symlinked separately).
  RewriteCond %{REQUEST_URI} ^/api/ [OR]
  RewriteCond %{REQUEST_URI} ^/storage/
  RewriteRule ^ - [L]

  # Serve real files/directories as-is; everything else falls back to the SPA.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
HTACCESS
fi

log "✅ Update complete — existing data preserved, no sample data seeded। সম্পন্ন হয়েছে।"
warn "cPanel has no systemctl/nginx reload step. If PHP code doesn't reflect immediately,"
warn "use cPanel → MultiPHP Manager / \"Restart PHP-FPM\" (or Setup Node.js App → Restart) for this domain."
