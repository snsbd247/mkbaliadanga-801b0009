#!/usr/bin/env bash
# =============================================================================
#  mkbaliadanga — One-Command VPS Installer
#  Repo:   https://github.com/snsbd247/mkbaliadanga-2fdd2e7e
#  Target: Fresh Ubuntu 22.04 / 24.04 LTS VPS (run as root)
#
#  Usage (one liner):
#    curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-2fdd2e7e/refs/heads/main/scripts/install.sh | sudo bash
#
#  Or with custom domain/email:
#    DOMAIN=mohammadkhani.com EMAIL=you@example.com bash install.sh
# =============================================================================
set -euo pipefail

# -------- Defaults (override via env vars) ----------
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUBDOMAIN="${API_SUBDOMAIN:-api.${DOMAIN}}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO_URL="${REPO_URL:-https://github.com/snsbd247/mkbaliadanga-2fdd2e7e.git}"
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="/home/${APP_USER}/mkapp"
SUPABASE_DIR="/home/${APP_USER}/supabase-project"
WEB_ROOT="/var/www/${DOMAIN}"
CRED_FILE="/root/mkapp-credentials.txt"

# -------- Colors ----------
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'
log()  { echo -e "${B}[$(date +%H:%M:%S)]${N} ${G}$*${N}"; }
warn() { echo -e "${Y}[WARN]${N} $*"; }
err()  { echo -e "${R}[ERROR]${N} $*" >&2; exit 1; }

# -------- Pre-flight ----------
[ "$EUID" -eq 0 ] || err "এই script root হিসেবে চালান:  sudo bash install.sh"
[ -f /etc/os-release ] || err "Ubuntu OS পাওয়া যায়নি"
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || warn "Tested on Ubuntu only — আপনার OS: $ID"

clear
cat <<EOF
==============================================================
  mkbaliadanga — One-Command VPS Installer
==============================================================
  Domain      : ${DOMAIN}
  API Domain  : ${API_SUBDOMAIN}
  Email (SSL) : ${EMAIL}
  Repo        : ${REPO_URL}
  App user    : ${APP_USER}
==============================================================
এই script ৩০-৪৫ মিনিট নেবে। চা খেয়ে আসুন।
DNS Record (A) আগেই point করেছেন তো?
   ${DOMAIN}      -> এই server-এর IP
   www.${DOMAIN}  -> এই server-এর IP
   ${API_SUBDOMAIN}  -> এই server-এর IP
==============================================================
EOF
sleep 5

# =============================================================================
# STEP 1: System update + base tools
# =============================================================================
log "[১/১১] System update + base tools install..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git nano ufw htop unzip jq openssl \
  ca-certificates gnupg lsb-release software-properties-common \
  apt-transport-https rsync cron

timedatectl set-timezone Asia/Dhaka || true

# =============================================================================
# STEP 2: Create app user
# =============================================================================
log "[২/১১] App user '${APP_USER}' তৈরি করা হচ্ছে..."
if ! id "$APP_USER" &>/dev/null; then
  USER_PASS=$(openssl rand -base64 16)
  adduser --disabled-password --gecos "" "$APP_USER"
  echo "${APP_USER}:${USER_PASS}" | chpasswd
  usermod -aG sudo "$APP_USER"
  echo "${APP_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${APP_USER}
  echo "USER_PASS=${USER_PASS}" >> "$CRED_FILE"
  log "User তৈরি: ${APP_USER} (password ${CRED_FILE} এ saved)"
else
  log "User ${APP_USER} already exists — skip"
fi

# =============================================================================
# STEP 3: Firewall
# =============================================================================
log "[৩/১১] Firewall (UFW) configure..."
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# =============================================================================
# STEP 4: Swap (if RAM < 4GB)
# =============================================================================
log "[৪/১১] Swap file check..."
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# =============================================================================
# STEP 5: Docker
# =============================================================================
log "[৫/১১] Docker install..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  usermod -aG docker "$APP_USER"
  systemctl enable --now docker
fi
docker --version

# =============================================================================
# STEP 6: Node.js 20
# =============================================================================
log "[৬/১১] Node.js 20 install..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
node --version

# =============================================================================
# STEP 7: Self-hosted Supabase
# =============================================================================
log "[৭/১১] Self-hosted Supabase setup..."
sudo -u "$APP_USER" -H bash <<EOSU
set -e
cd /home/${APP_USER}
if [ ! -d "${SUPABASE_DIR}" ]; then
  git clone --depth 1 https://github.com/supabase/supabase /home/${APP_USER}/supabase-src
  mkdir -p ${SUPABASE_DIR}
  cp -rf /home/${APP_USER}/supabase-src/docker/* ${SUPABASE_DIR}/
  cp /home/${APP_USER}/supabase-src/docker/.env.example ${SUPABASE_DIR}/.env
fi
EOSU

# Generate secrets if first run
if [ ! -f "${SUPABASE_DIR}/.secrets.generated" ]; then
  log "Supabase secrets generate করা হচ্ছে..."
  JWT_SECRET=$(openssl rand -hex 40)
  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  DASHBOARD_PASSWORD=$(openssl rand -hex 12)
  VAULT_ENC_KEY=$(openssl rand -hex 16)
  SECRET_KEY_BASE=$(openssl rand -hex 32)
  LOGFLARE_API_KEY=$(openssl rand -hex 16)
  LOGFLARE_PUBLIC_TOKEN=$(openssl rand -hex 32)
  LOGFLARE_PRIVATE_TOKEN=$(openssl rand -hex 32)
  POOLER_TENANT_ID=$(openssl rand -hex 8)

  # Generate JWT tokens (anon + service_role) using docker
  log "JWT tokens generate (Node.js দিয়ে)..."
  ANON_KEY=$(node -e "
    const c=require('crypto');
    const h={alg:'HS256',typ:'JWT'};
    const p={role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+10*365*24*3600};
    const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
    const d=b64(h)+'.'+b64(p);
    const s=c.createHmac('sha256','${JWT_SECRET}').update(d).digest('base64url');
    console.log(d+'.'+s);
  ")
  SERVICE_KEY=$(node -e "
    const c=require('crypto');
    const h={alg:'HS256',typ:'JWT'};
    const p={role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+10*365*24*3600};
    const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
    const d=b64(h)+'.'+b64(p);
    const s=c.createHmac('sha256','${JWT_SECRET}').update(d).digest('base64url');
    console.log(d+'.'+s);
  ")

  # Update .env
  ENV_FILE="${SUPABASE_DIR}/.env"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" "$ENV_FILE"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "$ENV_FILE"
  sed -i "s|^ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" "$ENV_FILE"
  sed -i "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_KEY}|" "$ENV_FILE"
  sed -i "s|^DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|" "$ENV_FILE"
  sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" "$ENV_FILE"
  sed -i "s|^SECRET_KEY_BASE=.*|SECRET_KEY_BASE=${SECRET_KEY_BASE}|" "$ENV_FILE" || true
  sed -i "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=${VAULT_ENC_KEY}|" "$ENV_FILE" || true
  sed -i "s|^LOGFLARE_API_KEY=.*|LOGFLARE_API_KEY=${LOGFLARE_API_KEY}|" "$ENV_FILE" || true
  # New variable names used by recent Supabase analytics image
  if grep -q '^LOGFLARE_PUBLIC_ACCESS_TOKEN=' "$ENV_FILE"; then
    sed -i "s|^LOGFLARE_PUBLIC_ACCESS_TOKEN=.*|LOGFLARE_PUBLIC_ACCESS_TOKEN=${LOGFLARE_PUBLIC_TOKEN}|" "$ENV_FILE"
  else
    echo "LOGFLARE_PUBLIC_ACCESS_TOKEN=${LOGFLARE_PUBLIC_TOKEN}" >> "$ENV_FILE"
  fi
  if grep -q '^LOGFLARE_PRIVATE_ACCESS_TOKEN=' "$ENV_FILE"; then
    sed -i "s|^LOGFLARE_PRIVATE_ACCESS_TOKEN=.*|LOGFLARE_PRIVATE_ACCESS_TOKEN=${LOGFLARE_PRIVATE_TOKEN}|" "$ENV_FILE"
  else
    echo "LOGFLARE_PRIVATE_ACCESS_TOKEN=${LOGFLARE_PRIVATE_TOKEN}" >> "$ENV_FILE"
  fi
  sed -i "s|^POOLER_TENANT_ID=.*|POOLER_TENANT_ID=${POOLER_TENANT_ID}|" "$ENV_FILE" || true
  sed -i "s|^SITE_URL=.*|SITE_URL=https://${DOMAIN}|" "$ENV_FILE"
  sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${API_SUBDOMAIN}|" "$ENV_FILE"
  sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://${API_SUBDOMAIN}|" "$ENV_FILE"
  sed -i "s|^SMTP_ADMIN_EMAIL=.*|SMTP_ADMIN_EMAIL=${EMAIL}|" "$ENV_FILE" || true

  chown ${APP_USER}:${APP_USER} "$ENV_FILE"
  touch "${SUPABASE_DIR}/.secrets.generated"

  # Save credentials
  cat >> "$CRED_FILE" <<EOF

============ SUPABASE CREDENTIALS ============
JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_KEY}
==============================================
EOF
  chmod 600 "$CRED_FILE"
fi

log "Supabase containers start..."
sudo -u "$APP_USER" -H bash -c "cd ${SUPABASE_DIR} && docker compose pull -q && docker compose up -d"
sleep 20

# =============================================================================
# STEP 8: Clone & build frontend
# =============================================================================
log "[৮/১১] Frontend code clone + build..."
sudo -u "$APP_USER" -H bash <<EOSU
set -e
if [ ! -d "${APP_DIR}" ]; then
  git clone ${REPO_URL} ${APP_DIR}
else
  cd ${APP_DIR} && git pull origin main || git pull origin master || true
fi
cd ${APP_DIR}

# Read anon key
ANON=\$(grep '^ANON_KEY=' ${SUPABASE_DIR}/.env | cut -d= -f2-)

cat > .env <<EOF
VITE_SUPABASE_URL=https://${API_SUBDOMAIN}
VITE_SUPABASE_PUBLISHABLE_KEY=\${ANON}
VITE_SUPABASE_PROJECT_ID=mkapp
EOF

npm ci --no-audit --no-fund || npm install --no-audit --no-fund
npm run build
EOSU

mkdir -p "${WEB_ROOT}"
cp -r "${APP_DIR}/dist/"* "${WEB_ROOT}/"
chown -R www-data:www-data "${WEB_ROOT}"

# =============================================================================
# STEP 9: Nginx
# =============================================================================
log "[৯/১১] Nginx install + configure..."
apt-get install -y -qq nginx
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/${DOMAIN} <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${WEB_ROOT};
    index index.html;
    client_max_body_size 50M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)\$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

cat > /etc/nginx/sites-available/${API_SUBDOMAIN} <<EOF
server {
    listen 80;
    server_name ${API_SUBDOMAIN};
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}
EOF

ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/${API_SUBDOMAIN} /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# =============================================================================
# STEP 10: SSL (Let's Encrypt)
# =============================================================================
log "[১০/১১] SSL certificate (Let's Encrypt) issue..."
apt-get install -y -qq certbot python3-certbot-nginx
if certbot --nginx \
    -d "${DOMAIN}" -d "www.${DOMAIN}" -d "${API_SUBDOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL}" --redirect; then
  log "✅ SSL successfully installed"
else
  warn "SSL fail করেছে — DNS propagate হয়নি সম্ভবত। ১ ঘণ্টা পর manually চালান:"
  warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${API_SUBDOMAIN}"
fi

# =============================================================================
# STEP 11: Backup script + cron
# =============================================================================
log "[১১/১১] Daily backup script setup..."
mkdir -p /var/backups/mkapp
cat > /usr/local/bin/mk-backup.sh <<EOF
#!/bin/bash
DATE=\$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR=/var/backups/mkapp
mkdir -p \$BACKUP_DIR
cd ${SUPABASE_DIR}
docker compose exec -T db pg_dumpall -U postgres > \$BACKUP_DIR/db_\$DATE.sql 2>/dev/null
tar -czf \$BACKUP_DIR/storage_\$DATE.tar.gz ${SUPABASE_DIR}/volumes/storage 2>/dev/null
cp ${SUPABASE_DIR}/.env \$BACKUP_DIR/env_\$DATE.bak
find \$BACKUP_DIR -type f -mtime +7 -delete
echo "[\$(date)] Backup OK"
EOF
chmod +x /usr/local/bin/mk-backup.sh
( crontab -l 2>/dev/null | grep -v mk-backup ; echo "0 2 * * * /usr/local/bin/mk-backup.sh >> /var/log/mk-backup.log 2>&1" ) | crontab -

# Update helper script
cat > /home/${APP_USER}/update.sh <<EOF
#!/bin/bash
set -e
cd ${APP_DIR}
git pull origin main || git pull origin master
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
npm run build
sudo cp -r dist/* ${WEB_ROOT}/
sudo chown -R www-data:www-data ${WEB_ROOT}
echo "✅ Update complete!"
EOF
chmod +x /home/${APP_USER}/update.sh
chown ${APP_USER}:${APP_USER} /home/${APP_USER}/update.sh

# =============================================================================
# DONE
# =============================================================================
clear
GREEN='\033[0;32m'; NC='\033[0m'
cat <<EOF

${GREEN}╔══════════════════════════════════════════════════════════╗
║          ✅  INSTALLATION COMPLETE!                       ║
╚══════════════════════════════════════════════════════════╝${NC}

🌐 আপনার Application:
   Frontend  : https://${DOMAIN}
   API       : https://${API_SUBDOMAIN}
   Studio    : https://${API_SUBDOMAIN}  (login: admin / dashboard password)

🔑 সব credentials এখানে saved:
   ${CRED_FILE}
   (এই file copy করে safe জায়গায় রাখুন!)

📦 দরকারি command:
   App update     : sudo -u ${APP_USER} /home/${APP_USER}/update.sh
   Backup এখনই   : sudo /usr/local/bin/mk-backup.sh
   Supabase logs  : cd ${SUPABASE_DIR} && docker compose logs -f
   Restart all    : cd ${SUPABASE_DIR} && docker compose restart

📅 Backup: প্রতি রাত ২টায় auto (/var/backups/mkapp/)

📚 পরের কাজ:
   1. ${CRED_FILE} ফাইল খুলে credentials safe করুন
   2. পুরাতন database থেকে data import (psql restore)
   3. Browser-এ https://${DOMAIN} test করুন

EOF
log "Setup শেষ — সব ভালো থাকুক! 🚀"
