#!/usr/bin/env bash
#
# MK Cooperative ERP — ONE-COMMAND fresh VPS installer
# ====================================================
# Sets up the FULL stack on a clean Ubuntu 22.04 / 24.04 VPS in a single command:
#   - PHP 8.2 (fpm + cli + extensions)  - Composer
#   - MySQL 8                           - phpMyAdmin
#   - Node 20 + frontend build          - Laravel API backend
#   - Nginx + Let's Encrypt SSL
#
# Fully idempotent: re-running continues where it left off and NEVER drops the
# database or overwrites an existing .env. Sample data is only seeded on the
# very FIRST install (fresh DB); later runs migrate without seeding.
#
# USAGE (as root on a fresh VPS):
#   curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/setup.sh \
#     | sudo DOMAIN=mohammadkhani.com EMAIL=admin@mohammadkhani.com bash
#
# Optional env vars:
#   DOMAIN        (default: mohammadkhani.com)
#   EMAIL         (default: admin@<DOMAIN>)     # Let's Encrypt notifications
#   REPO          (default: github snsbd247/mkbaliadanga-801b0009)
#   BRANCH        (default: main)
#   APP_DIR       (default: /var/www/mk)
#   PMA_PATH      (default: dbadmin)            # phpMyAdmin URL path -> /dbadmin
#   SKIP_SSL=1    (skip SSL if DNS not ready yet)
#
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-mohammadkhani.com}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO="${REPO:-https://github.com/snsbd247/mkbaliadanga-801b0009.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/mk}"
PMA_PATH="${PMA_PATH:-dbadmin}"
PHP_VER="8.2"
CRED_FILE="/root/mk-erp-credentials.txt"

log()  { echo -e "\n\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (use sudo)."
export DEBIAN_FRONTEND=noninteractive

# ──────────────────────────────────────────────────────────────────────────
# 1. System packages
# ──────────────────────────────────────────────────────────────────────────
log "Installing system packages…"
apt-get update -y
apt-get install -y software-properties-common curl git unzip ca-certificates gnupg lsb-release openssl

if ! command -v "php${PHP_VER}" >/dev/null 2>&1; then
  add-apt-repository -y ppa:ondrej/php
  apt-get update -y
fi

apt-get install -y \
  "php${PHP_VER}-fpm" "php${PHP_VER}-cli" "php${PHP_VER}-mysql" "php${PHP_VER}-pgsql" \
  "php${PHP_VER}-mbstring" "php${PHP_VER}-xml" "php${PHP_VER}-curl" "php${PHP_VER}-bcmath" \
  "php${PHP_VER}-zip" "php${PHP_VER}-gd" "php${PHP_VER}-intl" \
  mysql-server nginx certbot python3-certbot-nginx

# Composer
if ! command -v composer >/dev/null 2>&1; then
  log "Installing Composer…"
  curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
  php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f /tmp/composer-setup.php
fi

# Node 20
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "Installing Node.js 20…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Repository
# ──────────────────────────────────────────────────────────────────────────
if [ -d "${APP_DIR}/.git" ]; then
  log "Repo exists — updating…"
  git config --global --add safe.directory "${APP_DIR}" || true
  git -C "${APP_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
else
  log "Cloning repo…"
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --depth 1 -b "${BRANCH}" "${REPO}" "${APP_DIR}"
  git config --global --add safe.directory "${APP_DIR}" || true
fi

# ──────────────────────────────────────────────────────────────────────────
# 2b. Re-exec the freshly-pulled repo copy.
# When run via `curl | bash`, the piped script comes from GitHub's CDN, which
# can serve a STALE cached version. The repo we just pulled is always current,
# so hand off to its copy to guarantee the latest logic runs. The guard env var
# prevents an infinite loop.
# ──────────────────────────────────────────────────────────────────────────
REPO_SETUP="${APP_DIR}/scripts/setup.sh"
if [ -z "${MK_SETUP_REEXEC:-}" ] && [ -f "${REPO_SETUP}" ]; then
  log "Re-executing latest setup.sh from repo…"
  export MK_SETUP_REEXEC=1
  exec bash "${REPO_SETUP}"
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. MySQL database + users (app + phpMyAdmin)
# ──────────────────────────────────────────────────────────────────────────
log "Setting up MySQL…"
systemctl enable --now mysql

DB_NAME="mk_erp"
DB_USER="mk_erp"
FRESH_DB=0

# Reuse stored passwords so re-runs are non-destructive
read_cred() { grep "^$1=" "${CRED_FILE}" 2>/dev/null | cut -d= -f2- || true; }
DB_PASS="$(read_cred DB_PASSWORD)";   [ -n "${DB_PASS}" ]   || DB_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
PMA_PASS="$(read_cred PMA_PASSWORD)"; [ -n "${PMA_PASS}" ]  || PMA_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"

# Detect whether the app DB already has tables (=> not a fresh install)
if mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null | grep -qx 0; then
  FRESH_DB=1
elif ! mysql -N -e "USE ${DB_NAME};" 2>/dev/null; then
  FRESH_DB=1
fi

mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
-- phpMyAdmin admin user (full access for DB management)
CREATE USER IF NOT EXISTS 'pma_admin'@'localhost' IDENTIFIED BY '${PMA_PASS}';
ALTER USER 'pma_admin'@'localhost' IDENTIFIED BY '${PMA_PASS}';
GRANT ALL PRIVILEGES ON *.* TO 'pma_admin'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

# ──────────────────────────────────────────────────────────────────────────
# 4. phpMyAdmin (served at https://DOMAIN/<PMA_PATH>)
# ──────────────────────────────────────────────────────────────────────────
log "Installing phpMyAdmin…"
PMA_DIR="/usr/share/phpmyadmin"
if [ ! -f "${PMA_DIR}/index.php" ]; then
  PMA_VER="5.2.1"
  curl -fsSL "https://files.phpmyadmin.net/phpMyAdmin/${PMA_VER}/phpMyAdmin-${PMA_VER}-all-languages.tar.gz" -o /tmp/pma.tar.gz
  mkdir -p "${PMA_DIR}"
  tar xzf /tmp/pma.tar.gz -C /tmp
  cp -r "/tmp/phpMyAdmin-${PMA_VER}-all-languages/." "${PMA_DIR}/"
  rm -rf /tmp/pma.tar.gz "/tmp/phpMyAdmin-${PMA_VER}-all-languages"
fi
if [ ! -f "${PMA_DIR}/config.inc.php" ]; then
  PMA_BLOWFISH="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
  cat > "${PMA_DIR}/config.inc.php" <<PMACFG
<?php
\$cfg['blowfish_secret'] = '${PMA_BLOWFISH}';
\$i = 0;
\$i++;
\$cfg['Servers'][\$i]['auth_type'] = 'cookie';
\$cfg['Servers'][\$i]['host'] = '127.0.0.1';
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
\$cfg['UploadDir'] = '';
\$cfg['SaveDir'] = '';
\$cfg['TempDir'] = '/var/lib/phpmyadmin/tmp';
PMACFG
fi
mkdir -p /var/lib/phpmyadmin/tmp
chown -R www-data:www-data /var/lib/phpmyadmin

# ──────────────────────────────────────────────────────────────────────────
# 5. Backend (Laravel)
# ──────────────────────────────────────────────────────────────────────────
log "Setting up Laravel backend…"
cd "${APP_DIR}/backend"
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
# Composer 2.10+ runs as root safely with this flag, and we disable the
# security-advisory blocker so Laravel 11 resolves (advisories are noted in CI).
export COMPOSER_ALLOW_SUPERUSER=1
ensure_laravel_runtime_dirs
composer config --no-plugins policy.advisories.block false 2>/dev/null || true
# Retry install: GitHub codeload (dist zips) occasionally returns HTTP 400/429.
composer_install() {
  for attempt in 1 2 3 4 5; do
    ensure_laravel_runtime_dirs
    if composer install --no-dev --optimize-autoloader --no-interaction; then
      return 0
    fi
    warn "composer install failed (attempt ${attempt}/5) — clearing cache & retrying in 10s…"
    composer clear-cache >/dev/null 2>&1 || true
    sleep 10
  done
  # Last resort: build from source instead of GitHub dist zips.
  warn "Falling back to --prefer-source…"
  ensure_laravel_runtime_dirs
  composer install --no-dev --optimize-autoloader --no-interaction --prefer-source
}
composer_install

[ -f .env ] || cp .env.example .env

set_env() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
set_env APP_ENV production
set_env APP_DEBUG false
set_env APP_URL "https://${DOMAIN}"
set_env DB_CONNECTION mysql
set_env DB_HOST 127.0.0.1
set_env DB_PORT 3306
set_env DB_DATABASE "${DB_NAME}"
set_env DB_USERNAME "${DB_USER}"
set_env DB_PASSWORD "${DB_PASS}"
set_env SANCTUM_STATEFUL_DOMAINS "${DOMAIN},www.${DOMAIN}"
set_env CORS_ALLOWED_ORIGINS "https://${DOMAIN},https://www.${DOMAIN}"
# File-based cache/session: the login throttle middleware must not depend on a
# DB cache table (root cause of "Server Error" on /api/auth/login).
set_env CACHE_STORE file
set_env SESSION_DRIVER file

grep -q "^APP_KEY=base64:" .env || php artisan key:generate --force

if [ "${FRESH_DB}" = "1" ]; then
  log "Fresh database — migrating WITH seed (first install only)…"
  log "  → running: php artisan migrate --force --seed"
  php artisan migrate --force --seed
  log "  ✓ migrations applied + full sample seeders ran (fresh install)"
else
  warn "Existing database detected — migrating WITHOUT sample seed (data preserved)…"
  log "  → running: php artisan migrate --force"
  php artisan migrate --force
  log "  ⏭  skipped sample data seeders (existing DB — real data preserved)"
fi

# Always ensure roles + the two admin accounts exist. Fully idempotent
# (firstOrCreate / updateOrCreate / syncWithoutDetaching) — never touches real data.
#   developer    -> ismail162  / Admin@123
#   super_admin  -> suparadmin / Admin@123
log "Ensuring permissions + required admin accounts (idempotent)…"
log "  → running: php artisan db:seed --class=PermissionsSeeder"
php artisan db:seed --class=Database\\Seeders\\PermissionsSeeder --force && log "  ✓ PermissionsSeeder ok" || warn "  ✗ PermissionsSeeder failed"
log "  → running: php artisan db:seed --class=SuperAdminSeeder"
php artisan db:seed --class=Database\\Seeders\\SuperAdminSeeder --force && log "  ✓ SuperAdminSeeder ok" || warn "  ✗ SuperAdminSeeder failed"

# Auto-verify the two required admin accounts (creates/repairs if needed).
log "Verifying required admin accounts (developer + super_admin)…"
php artisan admin:verify --fix || warn "  ✗ admin verification reported problems — check output above"

php artisan config:clear; php artisan route:clear; php artisan view:clear
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data "${APP_DIR}/backend/storage" "${APP_DIR}/backend/bootstrap/cache"
chmod -R 775 "${APP_DIR}/backend/storage" "${APP_DIR}/backend/bootstrap/cache"

# ──────────────────────────────────────────────────────────────────────────
# 6. Frontend build
# ──────────────────────────────────────────────────────────────────────────
log "Building frontend…"
cd "${APP_DIR}"
echo "VITE_API_URL=https://${DOMAIN}/api" > .env.production
echo "VITE_BACKEND=laravel" >> .env.production
npm install
npm run build   # → dist/

# ──────────────────────────────────────────────────────────────────────────
# 7. Nginx (frontend + API + phpMyAdmin)
# ──────────────────────────────────────────────────────────────────────────
log "Configuring Nginx…"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
cat > "${NGINX_CONF}" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${APP_DIR}/dist;
    index index.html;
    client_max_body_size 50M;

    # phpMyAdmin → /${PMA_PATH}
    location /${PMA_PATH} {
        alias /usr/share/phpmyadmin;
        index index.php;
        location ~ ^/${PMA_PATH}/(.+\.php)\$ {
            alias /usr/share/phpmyadmin/\$1;
            include fastcgi_params;
            fastcgi_pass unix:/run/php/php${PHP_VER}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME \$request_filename;
        }
        location ~* ^/${PMA_PATH}/(.+\.(?:css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf))\$ {
            alias /usr/share/phpmyadmin/\$1;
        }
    }

    # API → Laravel public/
    location /api/ {
        root ${APP_DIR}/backend/public;
        try_files \$uri /index.php?\$query_string;
    }

    location ~ ^/index\.php\$ {
        root ${APP_DIR}/backend/public;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php${PHP_VER}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root/index.php;
        fastcgi_param PATH_INFO \$fastcgi_path_info;
    }

    # SPA fallback
    location / {
        try_files \$uri /index.html;
    }
}
NGINX

ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ──────────────────────────────────────────────────────────────────────────
# 8. SSL
# ──────────────────────────────────────────────────────────────────────────
if [ "${SKIP_SSL:-0}" = "1" ]; then
  warn "SKIP_SSL=1 — skipping SSL."
else
  log "Issuing SSL certificate…"
  if certbot --nginx --non-interactive --agree-tos -m "${EMAIL}" \
       -d "${DOMAIN}" -d "www.${DOMAIN}" --redirect; then
    log "SSL OK."
  else
    warn "SSL failed (DNS likely not propagated). Run later:"
    warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
  fi
fi

# ──────────────────────────────────────────────────────────────────────────
# 9. Credentials + summary
# ──────────────────────────────────────────────────────────────────────────
cd "${APP_DIR}/backend"
log "Final admin verification report (detected roles + active status)…"
php artisan admin:verify --fix || warn "  ✗ final admin verification reported problems — check output above"

cat > "${CRED_FILE}" <<CRED
# MK Cooperative ERP — server credentials  ($(date))
DOMAIN=${DOMAIN}
APP_DIR=${APP_DIR}

# MySQL (app)
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}

# phpMyAdmin  (https://${DOMAIN}/${PMA_PATH})
PMA_USER=pma_admin
PMA_PASSWORD=${PMA_PASS}

# App admin logins
LOGIN_URL=https://${DOMAIN}
# developer
LOGIN_USER_1=ismail162
LOGIN_PASS_1=Admin@123
# super_admin
LOGIN_USER_2=suparadmin
LOGIN_PASS_2=Admin@123
CRED
chmod 600 "${CRED_FILE}"

log "✅ Setup complete!"
cat <<DONE

────────────────────────────────────────────────
 🌐  Site         : https://${DOMAIN}
 🗄️  phpMyAdmin   : https://${DOMAIN}/${PMA_PATH}
       user: pma_admin   pass: ${PMA_PASS}
 👤  Developer    : ismail162 / Admin@123
 👤  Super Admin  : suparadmin / Admin@123
 🔎  Verify page  : https://${DOMAIN}/admin/verify
 📄  Credentials  : ${CRED_FILE}
────────────────────────────────────────────────
 ⚠️  Change passwords after first login.
 🔁  To update code later, run: scripts/update.sh
DONE
