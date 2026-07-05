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

# ── Dry-run mode ───────────────────────────────────────────────────────────
# `--dry-run` (or MK_DRY_RUN=1) runs every validation step (git status, sudo,
# disk, read-only checks) WITHOUT changing any files, pulling code, or building.
DRY_RUN="${MK_DRY_RUN:-0}"
# `--no-seed` (or MK_NO_SEED=1) skips the admin/permission seeders entirely, so
# a pure code update never touches user/admin accounts.
NO_SEED="${MK_NO_SEED:-0}"
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=1 ;;
    --no-seed) NO_SEED=1 ;;
  esac
done
export MK_NO_SEED="${NO_SEED}"

# Detect a read-only project filesystem so callers get a precise error instead
# of an opaque "Read-only file system" mid-deploy.
FS_READONLY=0
if ! (touch "${APP_DIR}/.mk-write-test" 2>/dev/null && rm -f "${APP_DIR}/.mk-write-test" 2>/dev/null); then
  FS_READONLY=1
fi

if [ "${DRY_RUN}" = "1" ]; then
  log "DRY-RUN: validation only — no files will be changed."
  git config --global --add safe.directory "${APP_DIR}" >/dev/null 2>&1 || true
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

# Print the exact failing command + exit code so the live console can highlight
# the root cause, then run the rollback.
FAILED_CMD=""
capture_failed_cmd() { FAILED_CMD="$BASH_COMMAND"; }
trap 'capture_failed_cmd' DEBUG

# Keep the release we started from. If a later deploy step fails after pulling
# new code, the script itself rolls back as root (the web user cannot reliably
# write .git/index.lock on root-owned checkouts).
ORIGINAL_HEAD="${ORIGINAL_HEAD:-$(git -C "${APP_DIR}" rev-parse HEAD 2>/dev/null || true)}"
export ORIGINAL_HEAD
rollback_on_error() {
  local status=$?
  trap - ERR DEBUG
  [ "${status}" -eq 0 ] && return 0

  echo -e "\033[1;31m[x] Deploy FAILED — exit code ${status}\033[0m" >&2
  [ -n "${FAILED_CMD:-}" ] && echo -e "\033[1;31m[x] Failing command: ${FAILED_CMD}\033[0m" >&2

  # Ensure git can write to the (root-owned) repo during rollback.
  git config --global --add safe.directory "${APP_DIR}" >/dev/null 2>&1 || true

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
# 0. Allow the web user (www-data) to trigger this script via sudo, so the
#    in-app "Pull & Deploy" button can run a full deploy without a shell.
# ──────────────────────────────────────────────────────────────────────────
install_deploy_sudoers() {
  local rule_file="/etc/sudoers.d/mk-deploy"
  local tmp_file="${rule_file}.tmp"
  local script_path="${APP_DIR}/scripts/update.sh"

  # Some hosting/container environments mount /etc read-only. Deploy must not
  # fail because it cannot refresh sudoers; setup.sh is the canonical installer
  # for this rule, and an existing rule is enough for in-app Pull & Deploy.
  if [ ! -d /etc/sudoers.d ] || [ ! -w /etc/sudoers.d ]; then
    warn "  ⚠ /etc/sudoers.d লেখা যাচ্ছে না — sudoers refresh skipped. Existing sudo rule will be used."
    return 0
  fi

  if ! {
    echo "# Managed by MK ERP — lets www-data run the deploy script for in-app Pull & Deploy"
    echo "www-data ALL=(root) NOPASSWD: ${script_path}"
    echo "www-data ALL=(root) NOPASSWD: /bin/bash ${script_path}"
    echo "www-data ALL=(root) NOPASSWD: /usr/bin/bash ${script_path}"
  } > "${tmp_file}"; then
    warn "  ⚠ sudoers temp file লেখা যায়নি — refresh skipped."
    rm -f "${tmp_file}" 2>/dev/null || true
    return 0
  fi

  if chmod 0440 "${tmp_file}" && visudo -cf "${tmp_file}" >/dev/null 2>&1 && mv "${tmp_file}" "${rule_file}"; then
    log "  ✓ deploy sudoers rule installed (${rule_file})"
  else
    warn "  ⚠ sudoers rule refresh failed — keeping existing rule if present."
    rm -f "${tmp_file}" 2>/dev/null || true
  fi
}
# Web-triggered deploys (Pull & Deploy button) must NEVER attempt to write
# sudoers or touch /etc — the sudoers rule is installed once by setup.sh. The
# controller sets MK_SKIP_SUDOERS=1 so a read-only /etc can't abort a deploy.
if [ "${MK_SKIP_SUDOERS:-0}" = "1" ]; then
  log "Skipping sudoers refresh (web-triggered deploy — managed by setup.sh)."
else
  install_deploy_sudoers
fi

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
# Force file-based cache/session so the login throttle middleware never depends
# on a DB cache table existing (root cause of past "Server Error" on /auth/login).
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
# Idempotent: guarantees roles + the two admin accounts exist WITHOUT touching
# any real data (firstOrCreate / updateOrCreate / syncWithoutDetaching only).
#   developer    -> ismail162  / Admin@123
#   super_admin  -> suparadmin / Admin@123
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
# 5. Final verification (BEFORE reloading services)
# ──────────────────────────────────────────────────────────────────────────
cd "${APP_DIR}/backend"
if [ "${NO_SEED}" = "1" ]; then
  log "Final report: --no-seed set — admin accounts left untouched (report only)."
  php artisan admin:verify || true
else
  log "Final admin verification report (detected roles + active status)…"
  php artisan admin:verify --fix || warn "  ✗ final admin verification reported problems — check output above"
fi

# ──────────────────────────────────────────────────────────────────────────
# 6. Reload services — DETACHED
# ──────────────────────────────────────────────────────────────────────────
# Reloading PHP-FPM / Nginx tears down the very PHP-FPM worker that is streaming
# this output to the browser, which severs the connection before the final
# "✅ সম্পন্ন হয়েছে" success line can be flushed — the UI then reports a false
# "network error" even though the deploy fully succeeded. To avoid this we emit
# the success marker FIRST, then perform the reloads in a detached background
# process (after a short delay) so the HTTP response completes cleanly.
log "Reloading PHP-FPM & Nginx (detached — deploy already complete)…"
# Patch legacy SPA fallback (`$uri $uri/` caused 404/redirect loops on routes
# like /help/). Rewrite to a clean single-page fallback if present.
for conf in /etc/nginx/sites-enabled/*.conf /etc/nginx/sites-available/*.conf; do
  [ -f "$conf" ] || continue
  sed -i 's#try_files \$uri \$uri/ /index.html;#try_files \$uri /index.html;#' "$conf" 2>/dev/null || true
done

# ✅ Success marker is printed BEFORE the reload so the stream can flush it.
log "✅ Update complete — existing data preserved, no sample data seeded. সম্পন্ন হয়েছে।"

# Detach the reloads: wait 3s (lets the HTTP stream finish) then reload services.
# Fully detached from the current process so ending this script/response won't
# interrupt the reload, and reloading FPM won't interrupt the response.
nohup bash -c "
  sleep 3
  systemctl reload 'php${PHP_VER}-fpm' || systemctl restart 'php${PHP_VER}-fpm' || true
  nginx -t && systemctl reload nginx || true
" </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true

