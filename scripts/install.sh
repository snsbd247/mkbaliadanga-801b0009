#!/usr/bin/env bash
# =============================================================================
#  MK Baliadanga — One-Command VPS Installer
#  Target  : Fresh Ubuntu 22.04 / 24.04 LTS, run as root
#  Domain  : mohammadkhani.com
#  Email   : ismailsagor162@gmail.com
#  Repo    : https://github.com/snsbd247/mkbaliadanga-801b0009.git
#
#  Usage (one command on a fresh VPS as root):
#    curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/install.sh | sudo bash
#
#  Or override defaults:
#    curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/install.sh \
#      | sudo DOMAIN=yourdomain.com EMAIL=you@example.com bash
#
#  Safe to re-run — idempotent. If a step fails (e.g. DNS not propagated),
#  fix the issue and re-run; previous progress is preserved.
# =============================================================================
set -euo pipefail

# ---------- Logging: tee everything to /root/mkbaliadanga-install.log ----------
LOG_FILE="${LOG_FILE:-/root/mkbaliadanga-install.log}"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "[install] === run started $(date -Iseconds) ==="

# ---------- Defaults (pre-filled for this project) ----------
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"
EMAIL="${EMAIL:-ismailsagor162@gmail.com}"
REPO_URL="${REPO_URL:-https://github.com/snsbd247/mkbaliadanga-801b0009.git}"
BRANCH="${BRANCH:-main}"
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="/home/${APP_USER}/mkbaliadanga"
WEB_ROOT="/var/www/${DOMAIN}"
CRED_FILE="/root/mkbaliadanga-credentials.txt"
SKIP_SSL="${SKIP_SSL:-0}"   # set to 1 to skip certbot
ENABLE_PGADMIN="${ENABLE_PGADMIN:-1}"   # set to 0 to skip pgAdmin GUI
PGADMIN_PORT="${PGADMIN_PORT:-5050}"
PGADMIN_PASSWORD="${PGADMIN_PASSWORD:-Admin@123456}"
PGADMIN_ALLOW_IP="${PGADMIN_ALLOW_IP:-}"   # e.g. 203.0.113.5 — restrict pgAdmin to this IP only

# ---------- Pretty ----------
C_R="\033[0;31m"; C_G="\033[0;32m"; C_Y="\033[1;33m"; C_C="\033[1;36m"; C_N="\033[0m"
log()  { echo -e "${C_C}[mk]${C_N} $*"; }
ok()   { echo -e "${C_G}[ok]${C_N} $*"; }
warn() { echo -e "${C_Y}[warn]${C_N} $*"; }
die()  { echo -e "${C_R}[err]${C_N} $*" >&2; exit 1; }

step() { echo; echo -e "${C_C}━━━ $* ━━━${C_N}"; }

generate_laravel_key() { printf 'base64:%s' "$(openssl rand -base64 32)"; }

ensure_env_app_key() {
  local env_file="$1"
  [ -f "$env_file" ] || die "Missing backend .env at $env_file"

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
  ok "APP_KEY generated in backend/.env before containers start"
}

[ "$(id -u)" = 0 ] || die "Run as root (use: sudo bash install.sh)"

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       MK Baliadanga — VPS One-Command Installer              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Domain : %-50s ║\n" "$DOMAIN"
printf "║  API    : %-50s ║\n" "$API_SUB"
printf "║  Email  : %-50s ║\n" "$EMAIL"
printf "║  Repo   : %-50s ║\n" "$REPO_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
echo

# ---------- 1. OS prerequisites ----------
step "1/14  Installing base system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release ufw fail2ban git \
  unattended-upgrades openssl jq cron certbot python3-certbot-nginx nginx \
  build-essential dnsutils rsync
ok "Base packages installed"

# ---------- 2. App user ----------
step "2/14  Creating app user '$APP_USER'"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG sudo "$APP_USER"
  ok "User $APP_USER created"
else
  ok "User $APP_USER already exists"
fi

# ---------- 3. Docker ----------
step "3/14  Installing Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
usermod -aG docker "$APP_USER" || true
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) ready"

# ---------- 4. Node 20 ----------
step "4/14  Installing Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v)"

# ---------- 5. Firewall ----------
step "5/14  Configuring firewall (UFW + fail2ban)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
if [ "$ENABLE_PGADMIN" = "1" ]; then
  if [ -n "$PGADMIN_ALLOW_IP" ]; then
    ufw allow from "$PGADMIN_ALLOW_IP" to any port ${PGADMIN_PORT} proto tcp
    log "pgAdmin port ${PGADMIN_PORT} restricted to ${PGADMIN_ALLOW_IP}"
  else
    ufw allow ${PGADMIN_PORT}/tcp
    warn "pgAdmin port ${PGADMIN_PORT} open to ALL IPs — set PGADMIN_ALLOW_IP to restrict"
  fi
fi
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null
ok "Firewall enabled (22, 80, 443$([ "$ENABLE_PGADMIN" = "1" ] && echo ", ${PGADMIN_PORT}"))"

# ---------- 5b. Swap (helps frontend build on 4GB VPS) ----------
if [ ! -f /swapfile ]; then
  log "Creating 4GB swapfile (improves Vite build stability on 4GB RAM VPS)"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  ok "Swap enabled (4GB)"
else
  ok "Swap already configured"
fi

# ---------- 6. DNS pre-flight ----------
step "6/14  Checking DNS for $DOMAIN, www.$DOMAIN, $API_SUB"
VPS_IP="$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
log "VPS public IP: $VPS_IP"
DNS_OK=1
for host in "$DOMAIN" "www.$DOMAIN" "$API_SUB"; do
  resolved="$(dig +short "$host" A | tail -n1)"
  if [ -z "$resolved" ]; then
    warn "$host → not resolving yet"
    DNS_OK=0
  elif [ "$resolved" = "$VPS_IP" ]; then
    ok "$host → $resolved (matches)"
  else
    warn "$host → $resolved (expected $VPS_IP)"
    DNS_OK=0
  fi
done
if [ "$DNS_OK" = "0" ]; then
  warn "DNS not fully propagated — SSL will be skipped. Re-run after DNS propagates:"
  warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_SUB} -m ${EMAIL} --agree-tos --redirect"
  SKIP_SSL=1
fi

# ---------- 7. Clone / update repository ----------
step "7/14  Cloning repository → $APP_DIR"
git config --global --add safe.directory "$APP_DIR" || true
if [ -d "$APP_DIR/.git" ]; then
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --all
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  ok "Repo updated to origin/$BRANCH"
else
  sudo -u "$APP_USER" git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  ok "Repo cloned"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---------- 8. Generate backend/.env ----------
step "8/14  Generating backend/.env (random secrets)"
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  rand() { openssl rand -hex 24; }
  PG_PASSWORD="$(rand)"
  REDIS_PASSWORD="$(rand)"
  MINIO_PASSWORD="$(rand)"
  APP_KEY_VALUE="$(generate_laravel_key)"
  DEV_PASSWORD="${DEV_PASSWORD:-123456}"
  SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-Admin@123456}"

  cat > "$ENV_FILE" <<EOF
APP_NAME="MK Baliadanga"
APP_ENV=production
APP_KEY=${APP_KEY_VALUE}
APP_DEBUG=false
APP_URL=https://${API_SUB}
APP_TIMEZONE=Asia/Dhaka
APP_LOCALE=bn

LOG_CHANNEL=stack
LOG_LEVEL=warning

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=mkbaliadanga
DB_USERNAME=mkb_user
DB_PASSWORD=${PG_PASSWORD}

BROADCAST_CONNECTION=log
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120

REDIS_HOST=redis
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_PORT=6379

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=mkb_minio
AWS_SECRET_ACCESS_KEY=${MINIO_PASSWORD}
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=mkb-assets
AWS_ENDPOINT=http://minio:9000
AWS_USE_PATH_STYLE_ENDPOINT=true
AWS_URL=https://${API_SUB}/files

SANCTUM_STATEFUL_DOMAINS=${DOMAIN},www.${DOMAIN},${API_SUB}
SESSION_DOMAIN=.${DOMAIN}
CORS_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

ADMIN_EMAIL=${EMAIL}
ADMIN_PASSWORD=${SUPERADMIN_PASSWORD}
ADMIN_NAME="System Admin"

DEV_EMAIL=ismail162@${DOMAIN}
DEV_PASSWORD=${DEV_PASSWORD}
SUPERADMIN_EMAIL=superadmin@${DOMAIN}
SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}

GREENWEB_SMS_TOKEN=
SMS_SENDER_ID=

MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@${DOMAIN}"
MAIL_FROM_NAME="\${APP_NAME}"
EOF
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  cat > "$CRED_FILE" <<EOF
==== MK Baliadanga credentials (generated $(date -Iseconds)) ====
Frontend             : https://${DOMAIN}
API                  : https://${API_SUB}/api
Health probe         : https://${API_SUB}/api/health

Postgres password    : ${PG_PASSWORD}
Redis password       : ${REDIS_PASSWORD}
MinIO root password  : ${MINIO_PASSWORD}

Login accounts (seeded):
  Developer  : ismail162   / ${DEV_PASSWORD}
  Superadmin : superadmin  / ${SUPERADMIN_PASSWORD}

Admin email          : ${EMAIL}
Backend env file     : ${ENV_FILE}
==================================================================
EOF
  chmod 600 "$CRED_FILE"
  ok "Secrets written → $CRED_FILE"
else
  warn "backend/.env exists — keeping existing secrets"
fi
ensure_env_app_key "$ENV_FILE"

# ---------- 9. Pre-create writable dirs on host (bind-mount safety) ----------
step "9/14  Preparing Laravel writable directories on host"
sudo -u "$APP_USER" mkdir -p \
  "$APP_DIR/backend/bootstrap/cache" \
  "$APP_DIR/backend/storage/framework/cache/data" \
  "$APP_DIR/backend/storage/framework/sessions" \
  "$APP_DIR/backend/storage/framework/views" \
  "$APP_DIR/backend/storage/framework/testing" \
  "$APP_DIR/backend/storage/logs" \
  "$APP_DIR/backend/storage/app/public"
chmod -R 775 "$APP_DIR/backend/bootstrap/cache" "$APP_DIR/backend/storage" 2>/dev/null || true
ok "Writable directories ensured"

# ---------- 9b. Build & start backend stack ----------
step "9b/14  Building + starting backend containers"
cd "$APP_DIR/backend"
sudo -u "$APP_USER" docker compose pull 2>/dev/null || true
sudo -u "$APP_USER" docker compose build
sudo -u "$APP_USER" docker compose up -d --force-recreate
ok "Containers started"

# ---------- 10. Wait for app + postgres ----------
step "10/14  Waiting for app + postgres to be ready"
for i in $(seq 1 60); do
  if docker exec mkb_app php -v >/dev/null 2>&1 \
     && docker exec mkb_postgres pg_isready -U mkb_user -d mkbaliadanga >/dev/null 2>&1; then
    ok "App + Postgres ready"
    break
  fi
  sleep 2
  [ "$i" = 60 ] && die "App/Postgres failed to start in 120s. Check: cd $APP_DIR/backend && docker compose logs"
done

# Ensure writable inside container (bind-mount overlay after entrypoint already
# handles it, but re-assert in case host UIDs differ).
docker exec mkb_app sh -c "chown -R www-data:www-data bootstrap/cache storage 2>/dev/null; chmod -R 775 bootstrap/cache storage 2>/dev/null" || true

# ---------- 11. Laravel bootstrap (idempotent + diagnostic) ----------
step "11/14  Laravel: composer install + key:generate + migrate + seed"
docker exec mkb_app composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

# Clear any stale cached config BEFORE generating key, otherwise the cached
# config can keep APP_KEY="" and Laravel throws "No application encryption key".
docker exec mkb_app php artisan config:clear || true
docker exec mkb_app php artisan cache:clear  || true

# Generate APP_KEY only if missing/empty in .env (idempotent across re-runs)
if ! docker exec mkb_app sh -c "grep -E '^APP_KEY=base64:.+' .env" >/dev/null 2>&1; then
  log "APP_KEY missing — generating new key"
  docker exec mkb_app php artisan key:generate --force --ansi
else
  ok "APP_KEY already set in .env"
fi

# Sanity: confirm the running app can actually read the key
if ! docker exec mkb_app php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); exit(empty(config("app.key")) ? 1 : 0);' 2>/dev/null; then
  warn "APP_KEY still empty after generate — forcing regenerate"
  docker exec mkb_app php artisan key:generate --force --ansi
fi

run_migrate() {
  local attempt=$1
  log "Running migrations (attempt ${attempt})…"
  if docker exec mkb_app php artisan migrate --force --no-ansi 2>&1 | tee /tmp/mkb-migrate.log; then
    return 0
  fi
  warn "Migration attempt ${attempt} failed. Last failing migration:"
  grep -Ei 'migrat|error|SQLSTATE' /tmp/mkb-migrate.log | tail -20 || true
  return 1
}

if ! run_migrate 1; then
  warn "Retrying migrations after 5s…"
  sleep 5
  if ! run_migrate 2; then
    die "Migrations failed after 2 attempts. Inspect: docker exec -it mkb_app php artisan migrate:status — full log at $LOG_FILE and /tmp/mkb-migrate.log"
  fi
fi

if ! docker exec mkb_app php artisan db:seed --force --no-ansi 2>&1 | tee /tmp/mkb-seed.log; then
  warn "Seeder reported issues — continuing (most seeders are idempotent). See /tmp/mkb-seed.log"
fi

docker exec mkb_app php artisan storage:link 2>/dev/null || true
docker exec mkb_app php artisan config:cache
docker exec mkb_app php artisan route:cache
ok "Backend bootstrapped (DB migrated + all reference data seeded)"

# ---------- 12. Frontend build ----------
step "12/14  Building frontend → $WEB_ROOT"
mkdir -p "$WEB_ROOT"
cd "$APP_DIR"
sudo -u "$APP_USER" \
  VITE_API_URL="https://${API_SUB}/api" VITE_BACKEND="laravel" VITE_USE_API="1" \
  NODE_OPTIONS="--max-old-space-size=3072" \
  bash -lc "npm install --no-audit --no-fund --legacy-peer-deps && npm run build" \
  || die "Frontend build failed. Check Node version: $(node -v)"
rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
ok "Frontend built + deployed"

# ---------- 13. Host nginx vhosts ----------
step "13/14  Configuring host nginx vhosts"
cat > /etc/nginx/sites-available/${DOMAIN}.conf <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${WEB_ROOT};
    index index.html;
    client_max_body_size 50M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    location / { try_files \$uri \$uri/ /index.html; }
    location ~* \.(js|css|png|jpg|jpeg|svg|woff2?|gif|ico)\$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location = /robots.txt { access_log off; log_not_found off; }
    location = /favicon.ico { access_log off; log_not_found off; }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${API_SUB};
    client_max_body_size 60M;
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 30;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/${DOMAIN}.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx vhosts active"

# ---------- 14. SSL ----------
step "14/14  Issuing Let's Encrypt SSL"
if [ "$SKIP_SSL" = "1" ]; then
  warn "Skipping SSL (DNS not ready). Run later:"
  warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_SUB} -m ${EMAIL} --agree-tos --redirect --non-interactive"
else
  if certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" \
       -d "$DOMAIN" -d "www.${DOMAIN}" -d "$API_SUB"; then
    ok "SSL issued for all 3 hostnames"
  else
    warn "Certbot failed — re-run after DNS propagates:"
    warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_SUB} -m ${EMAIL} --agree-tos --redirect"
  fi
fi

# ---------- Cron jobs ----------
log "Installing cron jobs (nightly backup + cert renew)..."
cat >/etc/cron.d/mkbaliadanga-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root ${APP_DIR}/scripts/backup.sh >> /var/log/mkbaliadanga-backup.log 2>&1
EOF
cat >/etc/cron.d/mkbaliadanga-certbot <<EOF
0 3 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
chmod 644 /etc/cron.d/mkbaliadanga-*

# ---------- pgAdmin (optional database GUI) ----------
if [ "$ENABLE_PGADMIN" = "1" ]; then
  step "Extra  Installing pgAdmin (database GUI on port ${PGADMIN_PORT})"
  BACKEND_NET="$(docker network ls --format '{{.Name}}' | grep -E 'backend_default|mkb' | head -n1 || true)"
  [ -z "$BACKEND_NET" ] && BACKEND_NET="backend_default"
  if ! docker ps -a --format '{{.Names}}' | grep -q '^mkb_pgadmin$'; then
    docker run -d --name mkb_pgadmin --restart unless-stopped \
      --network "$BACKEND_NET" \
      -p ${PGADMIN_PORT}:80 \
      -e PGADMIN_DEFAULT_EMAIL="${EMAIL}" \
      -e PGADMIN_DEFAULT_PASSWORD="${PGADMIN_PASSWORD}" \
      -e PGADMIN_CONFIG_SERVER_MODE=False \
      -e PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=False \
      dpage/pgadmin4:latest >/dev/null
    ok "pgAdmin running → http://${VPS_IP}:${PGADMIN_PORT}"
  else
    docker start mkb_pgadmin >/dev/null 2>&1 || true
    ok "pgAdmin already installed"
  fi
  # Append pgAdmin creds to credentials file
  if ! grep -q "pgAdmin" "$CRED_FILE" 2>/dev/null; then
    cat >> "$CRED_FILE" <<EOF

---- pgAdmin (DB GUI) ----
URL                  : http://${VPS_IP}:${PGADMIN_PORT}
Login email          : ${EMAIL}
Login password       : ${PGADMIN_PASSWORD}

Add server (inside pgAdmin):
  Name     : MK Baliadanga
  Host     : postgres        (container name on same docker network)
  Port     : 5432
  Database : mkbaliadanga
  Username : mkb_user
  Password : (see "Postgres password" above)
EOF
  fi
fi

# ---------- Final verification ----------
step "Final verification"
sleep 3
HEALTH_OK=1
if curl -fsS --max-time 10 "http://${DOMAIN}/" >/dev/null 2>&1 || curl -fsS --max-time 10 "https://${DOMAIN}/" >/dev/null 2>&1; then
  ok "Frontend responding"
else
  warn "Frontend not responding yet"
  HEALTH_OK=0
fi
if curl -fsS --max-time 10 "http://${API_SUB}/api/health" >/dev/null 2>&1 || curl -fsS --max-time 10 "https://${API_SUB}/api/health" >/dev/null 2>&1; then
  ok "API health probe responding"
else
  warn "API not responding yet"
  HEALTH_OK=0
fi

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  ✅  INSTALLATION COMPLETE                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo
echo -e "${C_G}Frontend       :${C_N} https://${DOMAIN}"
echo -e "${C_G}API            :${C_N} https://${API_SUB}/api"
echo -e "${C_G}Health probe   :${C_N} https://${API_SUB}/api/health"
echo -e "${C_G}Credentials    :${C_N} ${CRED_FILE}    ${C_Y}(KEEP THIS SAFE)${C_N}"
if [ "$ENABLE_PGADMIN" = "1" ]; then
echo -e "${C_G}pgAdmin (DB)   :${C_N} http://${VPS_IP}:${PGADMIN_PORT}  (login: ${EMAIL} / ${PGADMIN_PASSWORD})"
fi
echo
echo -e "${C_Y}Login accounts:${C_N}"
echo "  Developer  → ismail162  / 123456"
echo "  Superadmin → superadmin / Admin@123456"
echo
echo -e "${C_Y}Daily commands:${C_N}"
echo "  Update code      : sudo bash ${APP_DIR}/scripts/update.sh"
echo "  Health check     : sudo bash ${APP_DIR}/scripts/healthcheck.sh"
echo "  Backup now       : sudo bash ${APP_DIR}/scripts/backup.sh"
echo "  Backend logs     : cd ${APP_DIR}/backend && docker compose logs -f app"
echo "  Restart all      : cd ${APP_DIR}/backend && docker compose restart"
echo
echo -e "${C_Y}Database management:${C_N}"
echo "  psql console     : docker exec -it mkb_postgres psql -U mkb_user -d mkbaliadanga"
echo "  Run migrations   : docker exec mkb_app php artisan migrate --force"
echo "  Run seeders      : docker exec mkb_app php artisan db:seed --force"
echo "  Fresh + seed     : docker exec mkb_app php artisan migrate:fresh --seed --force  (⚠️ wipes data)"
echo "  Full DB guide    : ${APP_DIR}/docs/DATABASE.md"
echo

if [ "$HEALTH_OK" = "0" ]; then
  warn "Some health probes failed — wait 60s and run:  sudo bash ${APP_DIR}/scripts/healthcheck.sh"
fi
