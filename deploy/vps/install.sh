#!/usr/bin/env bash
#
# install.sh — One-command installer for mohammadkhani.com ERP
# Target: Fresh Ubuntu 22.04 / 24.04 VPS
# Stack:  Nginx + PHP 8.2-FPM + MySQL 8 + Node 20 + Certbot SSL
#
# Usage (as root):
#   DOMAIN=mohammadkhani.com REPO_URL=https://github.com/you/repo.git \
#   DB_PASSWORD='StrongPass!' bash install.sh
#
set -euo pipefail

# ── Config (override via env) ────────────────────────────────────────
DOMAIN="${DOMAIN:-mohammadkhani.com}"
APP_DIR="${APP_DIR:-/var/www/erp}"
REPO_URL="${REPO_URL:-}"
DB_NAME="${DB_NAME:-mohammadkhani}"
DB_USER="${DB_USER:-mkb_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: set DB_PASSWORD env var." >&2; exit 1
fi

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }

# ── 1. System packages ───────────────────────────────────────────────
log "Updating system & installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y software-properties-common curl git unzip ca-certificates lsb-release gnupg

log "Adding PHP 8.2 repository"
add-apt-repository -y ppa:ondrej/php
apt-get update -y

log "Installing Nginx, PHP 8.2-FPM, MySQL 8, Certbot"
apt-get install -y nginx mysql-server certbot python3-certbot-nginx \
  php8.2-fpm php8.2-cli php8.2-mysql php8.2-mbstring php8.2-xml \
  php8.2-curl php8.2-zip php8.2-bcmath php8.2-gd php8.2-intl

log "Installing Node 20 + Composer"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# ── 2. MySQL database & user ──────────────────────────────────────────
log "Creating MySQL database & user"
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# ── 3. Clone repo ─────────────────────────────────────────────────────
if [[ -n "$REPO_URL" ]]; then
  log "Cloning repository → $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  [[ -d "$APP_DIR/.git" ]] || git clone "$REPO_URL" "$APP_DIR"
else
  echo "REPO_URL not set — assuming code already present in $APP_DIR"
fi

BACKEND_DIR="$APP_DIR/erp-backend"

# ── 4. Backend: composer + .env + migrate ─────────────────────────────
log "Installing backend dependencies"
cd "$BACKEND_DIR"
composer install --no-dev --optimize-autoloader

if [[ ! -f .env ]]; then
  cp .env.example .env
  sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" .env
  sed -i "s|^DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
  sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env
  sed -i "s|^SUPERADMIN_EMAIL=.*|SUPERADMIN_EMAIL=${ADMIN_EMAIL}|" .env
fi

php artisan key:generate --force
php artisan migrate --force --seed
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"
chmod -R 775 "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache"

# ── 5. Frontend build → backend public/ ───────────────────────────────
log "Building frontend"
cd "$APP_DIR"
npm ci
echo "VITE_API_BASE_URL=https://${DOMAIN}/api" > .env.production.local
npm run build
rm -rf "$BACKEND_DIR/public/assets" "$BACKEND_DIR/public/index.html" 2>/dev/null || true
cp -r dist/* "$BACKEND_DIR/public/"

# ── 6. Nginx vhost ────────────────────────────────────────────────────
log "Configuring Nginx"
cat > /etc/nginx/sites-available/erp <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${BACKEND_DIR}/public;
    index index.php index.html;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* { deny all; }
    client_max_body_size 25M;
}
NGINX
ln -sf /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/erp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 7. SSL ────────────────────────────────────────────────────────────
log "Provisioning SSL (Certbot)"
certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect || \
  echo "Certbot failed — re-run manually once DNS points to this server."

log "Done! Visit https://${DOMAIN}  (login: ismail162)"
