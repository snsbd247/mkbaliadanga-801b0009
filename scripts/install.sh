#!/usr/bin/env bash
# =============================================================================
#  MK Baliadanga — Self-Hosted VPS One-Command Installer
#  Target: Fresh Ubuntu 22.04 / 24.04 LTS, run as root
#
#  Usage:
#    curl -fsSL https://mohammadkhani.com/install.sh | sudo bash
#  or:
#    DOMAIN=mohammadkhani.com EMAIL=admin@mohammadkhani.com bash scripts/install.sh
#
#  Stack provisioned (all in Docker):
#    - PostgreSQL 16          (data store)
#    - Redis 7                (cache + BullMQ queues)
#    - MinIO                  (S3-compatible object storage)
#    - NestJS API             (backend, business logic)
#    - React + Vite frontend  (Nginx-served)
#    - Nginx reverse proxy    (TLS termination, websocket)
#    - Backup sidecar         (nightly pg_dump + MinIO mirror)
# =============================================================================
set -euo pipefail
cd /root 2>/dev/null || cd /

# ---------- Configurable ----------
DOMAIN="${DOMAIN:-mohammadkhani.com}"
API_SUB="${API_SUB:-api.${DOMAIN}}"
FILES_SUB="${FILES_SUB:-files.${DOMAIN}}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO_URL="${REPO_URL:-https://github.com/snsbd247/mkbaliadanga-2fdd2e7e.git}"
BRANCH="${BRANCH:-main}"
APP_USER="${APP_USER:-mkadmin}"
APP_DIR="/home/${APP_USER}/mkbaliadanga"
CRED_FILE="/root/mkbaliadanga-credentials.txt"

# ---------- Colors ----------
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
  unattended-upgrades openssl jq cron certbot

# ---------- 2. App user ----------
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Creating user $APP_USER..."
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG sudo "$APP_USER"
fi

# ---------- 3. Docker + compose ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  usermod -aG docker "$APP_USER"
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
fi
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"

# ---------- 4. Firewall ----------
log "Configuring UFW firewall..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

# ---------- 5. Clone repository ----------
log "Cloning repository → $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only
else
  sudo -u "$APP_USER" git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---------- 6. Generate .env with secrets ----------
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "Generating .env with random secrets..."
  rand() { openssl rand -hex 32; }
  PG_PASSWORD="$(rand)"
  REDIS_PASSWORD="$(rand)"
  MINIO_PASSWORD="$(rand)"
  JWT_SECRET="$(rand)"
  SESSION_SECRET="$(rand)"
  cat > "$ENV_FILE" <<EOF
# ---- domains ----
DOMAIN=${DOMAIN}
API_URL=https://${API_SUB}
WEB_URL=https://${DOMAIN}
FILES_URL=https://${FILES_SUB}

# ---- postgres ----
PG_USER=mkapp
PG_PASSWORD=${PG_PASSWORD}
PG_DB=mkapp
DATABASE_URL=postgresql://mkapp:${PG_PASSWORD}@postgres:5432/mkapp?schema=public

# ---- redis ----
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ---- minio ----
MINIO_ROOT_USER=mkadmin
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false

# ---- auth ----
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
SESSION_SECRET=${SESSION_SECRET}

# ---- sms (fill in after install) ----
SMS_PROVIDER=greenweb
GREENWEB_TOKEN=

# ---- runtime ----
NODE_ENV=production
PORT=3000
EOF
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  cat > "$CRED_FILE" <<EOF
==== MK Baliadanga credentials (generated $(date -Iseconds)) ====
Postgres password : ${PG_PASSWORD}
Redis password    : ${REDIS_PASSWORD}
MinIO password    : ${MINIO_PASSWORD}
JWT secret        : ${JWT_SECRET}
Env file          : ${ENV_FILE}
==================================================================
EOF
  chmod 600 "$CRED_FILE"
  ok "Secrets written → $CRED_FILE"
else
  warn ".env already exists — keeping existing secrets"
fi

# ---------- 7. SSL certificates ----------
log "Issuing Let's Encrypt certificates (standalone)..."
systemctl stop nginx 2>/dev/null || true
docker stop mk_nginx 2>/dev/null || true
certbot certonly --standalone --non-interactive --agree-tos -m "$EMAIL" \
  -d "$DOMAIN" -d "www.${DOMAIN}" -d "$API_SUB" -d "$FILES_SUB" || \
  warn "Certbot failed — you can re-run later: certbot certonly --standalone -d $DOMAIN ..."

# ---------- 8. Bring up the stack ----------
cd "$APP_DIR/infra"
log "Pulling images..."
sudo -u "$APP_USER" docker compose --env-file "$ENV_FILE" pull || true
log "Building and starting containers..."
sudo -u "$APP_USER" docker compose --env-file "$ENV_FILE" up -d --build

# ---------- 9. Wait for API health ----------
log "Waiting for API to become healthy..."
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
    ok "API is up"
    break
  fi
  sleep 3
done

# ---------- 10. Run migrations + seed ----------
log "Running Prisma migrations + seed..."
sudo -u "$APP_USER" docker compose exec -T api pnpm prisma migrate deploy || warn "migrate deploy failed — re-run manually"
sudo -u "$APP_USER" docker compose exec -T api pnpm prisma db seed       || warn "seed failed — re-run manually"

# ---------- 11. Backup cron ----------
log "Installing nightly backup cron..."
cat >/etc/cron.d/mkbaliadanga-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * root ${APP_DIR}/scripts/backup.sh >> /var/log/mkbaliadanga-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/mkbaliadanga-backup

# ---------- 12. Cert auto-renew ----------
cat >/etc/cron.d/mkbaliadanga-certbot <<EOF
0 3 * * * root certbot renew --quiet --deploy-hook "docker exec mk_nginx nginx -s reload"
EOF

# ---------- 13. Create initial admin ----------
log "Creating initial super-admin (interactive)..."
sudo -u "$APP_USER" docker compose exec -T api node dist/scripts/create-admin.js \
  "${ADMIN_EMAIL:-admin@${DOMAIN}}" "${ADMIN_PASSWORD:-$(openssl rand -base64 12)}" \
  | tee -a "$CRED_FILE" || warn "Admin creation skipped (run later: docker compose exec api node dist/scripts/create-admin.js)"

# ---------- 14. Done ----------
ok "Installation complete"
echo
echo -e "${C_G}Frontend  :${C_N} https://${DOMAIN}"
echo -e "${C_G}API       :${C_N} https://${API_SUB}"
echo -e "${C_G}Files     :${C_N} https://${FILES_SUB}"
echo -e "${C_G}Credentials saved to:${C_N} $CRED_FILE"
echo
echo -e "${C_Y}Next steps:${C_N}"
echo "  • Verify health   : bash ${APP_DIR}/scripts/healthcheck.sh"
echo "  • Update later    : bash ${APP_DIR}/scripts/update.sh"
echo "  • Manual backup   : bash ${APP_DIR}/scripts/backup.sh"
echo "  • Restore archive : bash ${APP_DIR}/scripts/restore.sh /path/to/archive.tgz"
