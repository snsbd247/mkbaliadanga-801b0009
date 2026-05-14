#!/usr/bin/env bash
# =============================================================================
#  MK Baliadanga — One-Command VPS Installer (Laravel backend + Vite frontend)
#  Target  : Fresh Ubuntu 22.04 / 24.04 LTS, run as root
#  Domain  : mohammadkhani.com   (set DOMAIN= to override)
#  Repo    : https://github.com/snsbd247/mkbaliadanga-801b0009.git
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/install.sh \
#      | sudo DOMAIN=mohammadkhani.com EMAIL=ismailsagor162@gmail.com bash
#
#  Provisions (Docker):
#    - PostgreSQL 16, Redis 7, MinIO (S3 compatible)
#    - Laravel API (php-fpm) + nginx-fpm + queue worker + scheduler
#  On host:
#    - Node 20 (frontend build) → /var/www/${DOMAIN}
#    - Nginx reverse proxy + Certbot SSL for ${DOMAIN}, www, api.${DOMAIN}
#    - UFW firewall, fail2ban, nightly backup cron
# =============================================================================
set -euo pipefail

# ---------- Configurable ----------
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO_URL="${REPO_URL:-https://github.com/snsbd247/mkbaliadanga-801b0009.git}"
BRANCH="${BRANCH:-main}"
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="/home/${APP_USER}/mkbaliadanga"
WEB_ROOT="/var/www/${DOMAIN}"
CRED_FILE="/root/mkbaliadanga-credentials.txt"

# ---------- Pretty ----------
C_R="\033[0;31m"; C_G="\033[0;32m"; C_Y="\033[1;33m"; C_C="\033[1;36m"; C_N="\033[0m"
log()  { echo -e "${C_C}[mk]${C_N} $*"; }
ok()   { echo -e "${C_G}[ok]${C_N} $*"; }
warn() { echo -e "${C_Y}[warn]${C_N} $*"; }
die()  { echo -e "${C_R}[err]${C_N} $*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Run as root (sudo bash $0)"

# ---------- 1. OS prerequisites ----------
log "Updating apt + installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release ufw fail2ban git \
  unattended-upgrades openssl jq cron certbot python3-certbot-nginx nginx \
  build-essential

# ---------- 2. App user ----------
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Creating user $APP_USER..."
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG sudo "$APP_USER"
fi

# ---------- 3. Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
usermod -aG docker "$APP_USER" || true
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"

# ---------- 4. Node 20 (for frontend build) ----------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v)"

# ---------- 5. Firewall ----------
log "Configuring UFW + fail2ban..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

# ---------- 6. Clone repository ----------
log "Cloning repository → $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git config --global --add safe.directory "$APP_DIR" || true
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --all
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  sudo -u "$APP_USER" git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---------- 7. Generate backend/.env ----------
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "Generating backend/.env with random secrets..."
  rand() { openssl rand -hex 24; }
  PG_PASSWORD="$(rand)"
  REDIS_PASSWORD="$(rand)"
  MINIO_PASSWORD="$(rand)"
  DEV_PASSWORD="${DEV_PASSWORD:-123456}"
  SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-Admin@123456}"

  cat > "$ENV_FILE" <<EOF
APP_NAME="MK Baliadanga"
APP_ENV=production
APP_KEY=
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

ADMIN_EMAIL=admin@${DOMAIN}
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
Domain               : https://${DOMAIN}
API                  : https://${API_SUB}/api
Postgres password    : ${PG_PASSWORD}
Redis password       : ${REDIS_PASSWORD}
MinIO root password  : ${MINIO_PASSWORD}

Login accounts (created by seeder):
  Developer  : ismail162   / ${DEV_PASSWORD}
  Superadmin : superadmin  / ${SUPERADMIN_PASSWORD}

Backend env file     : ${ENV_FILE}
==================================================================
EOF
  chmod 600 "$CRED_FILE"
  ok "Secrets written → $CRED_FILE"
else
  warn "backend/.env already exists — keeping existing secrets"
fi

# ---------- 8. Build & start backend stack ----------
cd "$APP_DIR/backend"
log "Building Docker images..."
sudo -u "$APP_USER" docker compose pull || true
sudo -u "$APP_USER" docker compose build
log "Starting containers..."
sudo -u "$APP_USER" docker compose up -d

# ---------- 9. Laravel bootstrap ----------
log "Waiting for app container..."
for i in $(seq 1 30); do
  if docker exec mkb_app php -v >/dev/null 2>&1; then break; fi
  sleep 2
done

log "Installing composer deps + key/migrate/seed..."
docker exec mkb_app composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader || true
docker exec mkb_app php artisan key:generate --force
docker exec mkb_app php artisan migrate --force
docker exec mkb_app php artisan db:seed --force
docker exec mkb_app php artisan storage:link || true
docker exec mkb_app php artisan config:cache
docker exec mkb_app php artisan route:cache

# ---------- 10. Frontend build ----------
log "Building frontend (Vite) → ${WEB_ROOT}"
mkdir -p "$WEB_ROOT"
cd "$APP_DIR"
sudo -u "$APP_USER" VITE_API_URL="https://${API_SUB}/api" VITE_BACKEND="laravel" VITE_USE_API="1" \
  bash -lc "npm ci && npm run build"
rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

# ---------- 11. Host nginx vhosts ----------
log "Writing nginx vhosts for ${DOMAIN} and ${API_SUB}..."
cat > /etc/nginx/sites-available/${DOMAIN}.conf <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${WEB_ROOT};
    index index.html;
    client_max_body_size 50M;
    location / { try_files \$uri \$uri/ /index.html; }
    location ~* \\.(js|css|png|jpg|jpeg|svg|woff2?)\$ {
        expires 30d; add_header Cache-Control "public, immutable";
    }
}

server {
    listen 80;
    server_name ${API_SUB};
    client_max_body_size 60M;
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/${DOMAIN}.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------- 12. SSL ----------
log "Issuing Let's Encrypt SSL..."
certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" \
  -d "$DOMAIN" -d "www.${DOMAIN}" -d "$API_SUB" || \
  warn "Certbot failed — DNS may not be propagated. Re-run later: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_SUB}"

# ---------- 13. Cron: backup + cert renew ----------
log "Installing cron jobs..."
cat >/etc/cron.d/mkbaliadanga-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root ${APP_DIR}/scripts/backup.sh >> /var/log/mkbaliadanga-backup.log 2>&1
EOF
cat >/etc/cron.d/mkbaliadanga-certbot <<EOF
0 3 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF
chmod 644 /etc/cron.d/mkbaliadanga-*

# ---------- 14. Done ----------
ok "Installation complete"
echo
echo -e "${C_G}Frontend     :${C_N} https://${DOMAIN}"
echo -e "${C_G}API          :${C_N} https://${API_SUB}/api"
echo -e "${C_G}Health probe :${C_N} https://${API_SUB}/api/health"
echo -e "${C_G}Credentials  :${C_N} ${CRED_FILE}"
echo
echo -e "${C_Y}Login accounts:${C_N}"
echo "  Developer  → ismail162  / 123456"
echo "  Superadmin → superadmin / Admin@123456"
echo
echo -e "${C_Y}Useful commands:${C_N}"
echo "  Update     : sudo bash ${APP_DIR}/scripts/update.sh"
echo "  Health     : sudo bash ${APP_DIR}/scripts/healthcheck.sh"
echo "  Backup now : sudo bash ${APP_DIR}/scripts/backup.sh"
echo "  Logs       : cd ${APP_DIR}/backend && docker compose logs -f app"
