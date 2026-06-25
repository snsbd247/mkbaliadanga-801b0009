#!/usr/bin/env bash
#
# MK Cooperative ERP — One-command VPS installer
# ------------------------------------------------
# Fresh Ubuntu 22.04 / 24.04 VPS এ পুরো অ্যাপ (Laravel API + React frontend +
# MySQL + Nginx + SSL) এক কমান্ডেই সেটআপ করে। সম্পূর্ণ idempotent — আবার চালালে
# যেখানে থেমেছিল সেখান থেকে continue করবে, existing .env / database মুছবে না।
#
# ব্যবহার (fresh VPS এ root হিসেবে):
#   curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/install.sh \
#     | sudo DOMAIN=mohammadkhani.com EMAIL=admin@mohammadkhani.com bash
#
# Optional env vars:
#   DOMAIN     (default: mohammadkhani.com)
#   EMAIL      (default: admin@<DOMAIN>)        # Let's Encrypt notifications
#   REPO       (default: https://github.com/snsbd247/mkbaliadanga-801b0009.git)
#   BRANCH     (default: main)
#   APP_DIR    (default: /var/www/mk)
#   SKIP_SSL=1 (DNS এখনো ready না হলে SSL ধাপ বাদ দিতে)
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
PHP_VER="8.2"
CRED_FILE="/root/mk-erp-credentials.txt"

log()  { echo -e "\n\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "root হিসেবে চালান (sudo ব্যবহার করুন)।"

export DEBIAN_FRONTEND=noninteractive

# ──────────────────────────────────────────────────────────────────────────
# 1. System packages
# ──────────────────────────────────────────────────────────────────────────
log "সিস্টেম প্যাকেজ ইনস্টল হচ্ছে…"
apt-get update -y
apt-get install -y software-properties-common curl git unzip ca-certificates gnupg lsb-release

# PHP 8.2 (ondrej PPA — Ubuntu 22.04 এ দরকার)
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
  log "Composer ইনস্টল হচ্ছে…"
  curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
  php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
  rm -f /tmp/composer-setup.php
fi

# Node 20
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "Node.js 20 ইনস্টল হচ্ছে…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Repository
# ──────────────────────────────────────────────────────────────────────────
if [ -d "${APP_DIR}/.git" ]; then
  log "রিপো আগে থেকেই আছে — আপডেট হচ্ছে…"
  git -C "${APP_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
else
  log "রিপো ক্লোন হচ্ছে…"
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --depth 1 -b "${BRANCH}" "${REPO}" "${APP_DIR}"
fi

# ──────────────────────────────────────────────────────────────────────────
# 3. MySQL database + user
# ──────────────────────────────────────────────────────────────────────────
log "MySQL ডাটাবেস সেটআপ হচ্ছে…"
systemctl enable --now mysql

DB_NAME="mk_erp"
DB_USER="mk_erp"
if [ -f "${CRED_FILE}" ] && grep -q '^DB_PASSWORD=' "${CRED_FILE}"; then
  DB_PASS="$(grep '^DB_PASSWORD=' "${CRED_FILE}" | cut -d= -f2-)"
else
  DB_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
fi

mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# ──────────────────────────────────────────────────────────────────────────
# 4. Backend (Laravel)
# ──────────────────────────────────────────────────────────────────────────
log "ব্যাকেন্ড (Laravel) সেটআপ হচ্ছে…"
cd "${APP_DIR}/backend"
composer install --no-dev --optimize-autoloader --no-interaction

if [ ! -f .env ]; then
  cp .env.example .env
fi

# .env মান বসানো
set_env() { # key value
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
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

php artisan key:generate --force
php artisan migrate --force --seed
php artisan config:cache
php artisan route:cache

# Permissions
chown -R www-data:www-data "${APP_DIR}/backend/storage" "${APP_DIR}/backend/bootstrap/cache"
chmod -R 775 "${APP_DIR}/backend/storage" "${APP_DIR}/backend/bootstrap/cache"

# ──────────────────────────────────────────────────────────────────────────
# 5. Frontend (React build)
# ──────────────────────────────────────────────────────────────────────────
log "ফ্রন্টএন্ড বিল্ড হচ্ছে…"
cd "${APP_DIR}"
echo "VITE_API_URL=https://${DOMAIN}/api" > .env.production
echo "VITE_BACKEND=laravel" >> .env.production
npm ci
npm run build   # → dist/

# ──────────────────────────────────────────────────────────────────────────
# 6. Nginx
# ──────────────────────────────────────────────────────────────────────────
log "Nginx কনফিগার হচ্ছে…"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
cat > "${NGINX_CONF}" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${APP_DIR}/dist;
    index index.html;

    client_max_body_size 25M;

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
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ──────────────────────────────────────────────────────────────────────────
# 7. SSL (Let's Encrypt)
# ──────────────────────────────────────────────────────────────────────────
if [ "${SKIP_SSL:-0}" = "1" ]; then
  warn "SKIP_SSL=1 — SSL ধাপ বাদ দেওয়া হলো।"
else
  log "SSL সার্টিফিকেট ইস্যু হচ্ছে…"
  if certbot --nginx --non-interactive --agree-tos -m "${EMAIL}" \
       -d "${DOMAIN}" -d "www.${DOMAIN}" --redirect; then
    log "SSL সফল।"
  else
    warn "SSL fail — সম্ভবত DNS এখনো propagate হয়নি। পরে চালান:"
    warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
  fi
fi

# ──────────────────────────────────────────────────────────────────────────
# 8. Credentials file + summary
# ──────────────────────────────────────────────────────────────────────────
cat > "${CRED_FILE}" <<CRED
# MK Cooperative ERP — সার্ভার credentials  ($(date))
DOMAIN=${DOMAIN}
APP_DIR=${APP_DIR}

# MySQL
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}

# সফটওয়্যার লগইন (super admin)
LOGIN_URL=https://${DOMAIN}
LOGIN_USER=ismail162
LOGIN_PASS=Admin@123
CRED
chmod 600 "${CRED_FILE}"

log "✅ সেটআপ সম্পন্ন!"
cat <<DONE

────────────────────────────────────────────────
 🌐  সাইট       : https://${DOMAIN}
 👤  লগইন ইউজার : ismail162
 🔑  পাসওয়ার্ড  : Admin@123
 📄  credentials: ${CRED_FILE}
────────────────────────────────────────────────
 ⚠️  প্রথম লগইনের পরই পাসওয়ার্ড পরিবর্তন করুন।
 🔁  কোড আপডেট করতে আবার এই স্ক্রিপ্টটি চালান।
DONE
