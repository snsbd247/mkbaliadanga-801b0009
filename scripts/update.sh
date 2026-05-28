#!/usr/bin/env bash
# =============================================================================
#  MK Baliadanga — Update / Re-seed script
#
#  What it does (safe to run any number of times):
#    1. Pull latest code from main
#    2. Rebuild backend Docker containers
#    3. composer install + run any pending migrations
#    4. Run FULL DatabaseSeeder (idempotent — refreshes all reference data:
#         roles, permissions, divisions/districts/upazilas/mouzas,
#         demo office, admin + developer users, chart of accounts,
#         irrigation categories, sequence fixes)
#    5. Rebuild frontend (Vite) + redeploy to nginx web root
#    6. Reload nginx + restart queue workers
#    7. Run healthcheck
# =============================================================================
set -euo pipefail

LOG_FILE="${LOG_FILE:-/root/mkbaliadanga-update.log}"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "[update] === run started $(date -Iseconds) ==="

DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/mkbaliadanga}"
WEB_ROOT="${WEB_ROOT:-/var/www/${DOMAIN}}"

C_G="\033[0;32m"; C_Y="\033[1;33m"; C_C="\033[1;36m"; C_R="\033[0;31m"; C_N="\033[0m"
log()  { echo -e "${C_C}[mk]${C_N} $*"; }
ok()   { echo -e "${C_G}[ok]${C_N} $*"; }
warn() { echo -e "${C_Y}[warn]${C_N} $*"; }
die()  { echo -e "${C_R}[err]${C_N} $*" >&2; exit 1; }
step() { echo; echo -e "${C_C}━━━ $* ━━━${C_N}"; }

generate_laravel_key() { printf 'base64:%s' "$(openssl rand -base64 32)"; }

ensure_env_app_key() {
  local env_file="$APP_DIR/backend/.env"
  [ -f "$env_file" ] || die "Missing backend .env at $env_file — run install.sh first."

  if grep -Eq '^APP_KEY=base64:.+' "$env_file"; then
    ok "APP_KEY already present in backend/.env"
    return 0
  fi

  local app_key
  app_key="$(generate_laravel_key)"
  if grep -q '^APP_KEY=' "$env_file"; then
    sed -i "s|^APP_KEY=.*|APP_KEY=${app_key}|" "$env_file"
  else
    printf '\nAPP_KEY=%s\n' "$app_key" >> "$env_file"
  fi
  chown "$APP_USER":"$APP_USER" "$env_file" 2>/dev/null || true
  chmod 600 "$env_file" 2>/dev/null || true
  ok "APP_KEY generated in backend/.env"
}

[ "$(id -u)" = 0 ] || die "Run as root (sudo bash $0)"
[ -d "$APP_DIR/.git" ] || die "Repo missing at $APP_DIR — run install.sh first."

# ---------- 1. Pull code ----------
step "1/7  Pulling latest code"
cd "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" || true
sudo -u "$APP_USER" git fetch --all
sudo -u "$APP_USER" git reset --hard origin/main
ok "Code synced to origin/main"

ensure_env_app_key

# ---------- 2. Rebuild backend containers ----------
step "2/7  Rebuilding backend containers"
cd "$APP_DIR/backend"
sudo -u "$APP_USER" docker compose pull 2>/dev/null || true
sudo -u "$APP_USER" docker compose up -d --build --force-recreate app queue scheduler nginx
ok "Containers up"

# ---------- 2b. Ensure host writable dirs (bind-mount safety) ----------
sudo -u "$APP_USER" mkdir -p \
  "$APP_DIR/backend/bootstrap/cache" \
  "$APP_DIR/backend/storage/framework/cache/data" \
  "$APP_DIR/backend/storage/framework/sessions" \
  "$APP_DIR/backend/storage/framework/views" \
  "$APP_DIR/backend/storage/logs" \
  "$APP_DIR/backend/storage/app/public"
chmod -R 775 "$APP_DIR/backend/bootstrap/cache" "$APP_DIR/backend/storage" 2>/dev/null || true

# ---------- 3. Wait for app + postgres ----------
step "3/7  Waiting for app + postgres"
for i in $(seq 1 60); do
  if docker exec mkb_app php -v >/dev/null 2>&1 \
     && docker exec mkb_postgres pg_isready -U mkb_user -d mkbaliadanga >/dev/null 2>&1; then
    ok "App + Postgres ready"
    break
  fi
  sleep 2
  [ "$i" = 60 ] && die "App/Postgres not ready after 120s. Check: docker compose logs"
done

docker exec mkb_app sh -c "chown -R www-data:www-data bootstrap/cache storage 2>/dev/null; chmod -R 775 bootstrap/cache storage 2>/dev/null" || true

# ---------- 4. Composer + migrate + seed ----------
step "4/7  Composer + migrate + seed (idempotent)"
docker exec mkb_app composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

# Clear stale config BEFORE checking APP_KEY (cached config can mask empty key)
docker exec mkb_app php artisan config:clear || true

# Ensure APP_KEY exists (don't regenerate if already set — would invalidate sessions/encrypted data)
if ! docker exec mkb_app sh -c "grep -E '^APP_KEY=base64:.+' .env" >/dev/null 2>&1; then
  warn "APP_KEY missing in .env — generating one"
  docker exec mkb_app php artisan key:generate --force --ansi
fi

if ! docker exec mkb_app php artisan migrate --force --no-ansi 2>&1 | tee /tmp/mkb-migrate.log; then
  warn "Migration failed — retrying once after 5s"
  sleep 5
  docker exec mkb_app php artisan migrate --force --no-ansi 2>&1 | tee /tmp/mkb-migrate.log \
    || die "Migrations failed twice. See /tmp/mkb-migrate.log and $LOG_FILE"
fi
# Full DatabaseSeeder = all reference data, all idempotent (firstOrCreate / updateOrCreate)
docker exec mkb_app php artisan db:seed --force --no-ansi 2>&1 | tee /tmp/mkb-seed.log \
  || warn "Seeder reported issues — continuing (see /tmp/mkb-seed.log)"
ok "Migrations + full seed completed"

# ---------- 5. Cache refresh ----------
step "5/7  Cache + route + queue refresh"
docker exec mkb_app php artisan config:clear
docker exec mkb_app php artisan route:clear
docker exec mkb_app php artisan view:clear
docker exec mkb_app php artisan config:cache
docker exec mkb_app php artisan route:cache
docker exec mkb_app php artisan queue:restart || true
ok "Caches rebuilt + queue workers restarted"

# ---------- 6. Frontend rebuild ----------
step "6/7  Rebuilding frontend → $WEB_ROOT"
cd "$APP_DIR"
sudo -u "$APP_USER" \
  VITE_API_URL="https://${API_SUB}/api" VITE_BACKEND="laravel" VITE_USE_API="1" \
  NODE_OPTIONS="--max-old-space-size=3072" \
  bash -lc "npm install --no-audit --no-fund --legacy-peer-deps && npm run build" \
  || die "Frontend build failed (Node $(node -v 2>/dev/null || echo missing))"
mkdir -p "$WEB_ROOT"
rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
systemctl reload nginx || true
ok "Frontend deployed + nginx reloaded"

# ---------- 7. Healthcheck ----------
step "7/7  Healthcheck"
if [ -x "$APP_DIR/scripts/healthcheck.sh" ]; then
  bash "$APP_DIR/scripts/healthcheck.sh" || warn "Healthcheck reported issues — investigate above"
else
  warn "healthcheck.sh missing — skipping"
fi

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ✅  UPDATE COMPLETE                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo
echo -e "${C_G}Frontend :${C_N} https://${DOMAIN}"
echo -e "${C_G}API      :${C_N} https://${API_SUB}/api"
echo -e "${C_G}Health   :${C_N} https://${API_SUB}/api/health"
