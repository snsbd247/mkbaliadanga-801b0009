#!/usr/bin/env bash
# =============================================================================
# deploy/install.sh — one-command, idempotent VPS deployment
#
#   sudo bash install.sh
#
# Brings up: Docker, Coolify, self-hosted Supabase, the Vite/React app, a Caddy
# reverse proxy (auto SSL), firewall + Fail2ban + SSH hardening, daily backups.
# Safe to re-run. Detailed logging to /var/log/mkbaliadanga/deploy.log.
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

need_root
mkdir -p "$LOG_DIR" "$STATE_DIR" "$BACKUP_DIR"
log "===== MK Baliadanga VPS installer started ====="

rollback() {
  warn "Attempting graceful rollback of the last compose bring-up…"
  cd "$DEPLOY_DIR" || return 0
  docker compose --env-file "$ENV_FILE" -f docker-compose.yml down 2>/dev/null || true
}

# ----------------------------------------------------------------------------- 0. Detect project
detect_project() {
  log "Analyzing repository at $ROOT_DIR…"
  local f="$ROOT_DIR/package.json"
  [[ -f "$f" ]] || die "package.json not found — run from inside the repo."
  grep -q '"vite"'        "$f" && ok "Detected Vite"        || warn "Vite not detected"
  grep -q '"react"'       "$f" && ok "Detected React"       || warn "React not detected"
  grep -q '"typescript"'  "$f" && ok "Detected TypeScript"  || warn "TypeScript not detected"
  grep -rq '@supabase/supabase-js' "$ROOT_DIR/src" 2>/dev/null && ok "Detected Supabase client usage" || warn "Supabase client not detected"
  [[ -d "$ROOT_DIR/supabase/functions" ]] && ok "Detected Edge Functions ($(ls -1 "$ROOT_DIR/supabase/functions" | wc -l))" || warn "No edge functions dir"
  [[ -d "$ROOT_DIR/supabase/migrations" ]] && ok "Detected $(ls -1 "$ROOT_DIR/supabase/migrations"/*.sql 2>/dev/null | wc -l) migration(s)" || warn "No migrations dir"
}

# ----------------------------------------------------------------------------- 1. System update
system_update() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y && apt-get upgrade -y
  apt-get install -y ca-certificates curl gnupg lsb-release ufw fail2ban \
    openssl rsync jq cron git apache2-utils
}

# ----------------------------------------------------------------------------- 2. Docker + Compose
install_docker() {
  if have docker; then ok "Docker present ($(docker --version))"; else
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker
  docker compose version >/dev/null 2>&1 || die "Docker Compose plugin missing."
}

# ----------------------------------------------------------------------------- 3. Coolify
install_coolify() {
  if [[ -d /data/coolify ]]; then ok "Coolify already installed."; return 0; fi
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
}

# ----------------------------------------------------------------------------- 4. Docker network
create_network() {
  docker network inspect mk_net >/dev/null 2>&1 || docker network create mk_net
}

# ----------------------------------------------------------------------------- 5. Firewall
configure_firewall() {
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 8000/tcp   # Coolify dashboard (proxied via Caddy)
  ufw --force enable
}

# ----------------------------------------------------------------------------- 6. Security hardening
harden_server() {
  # Fail2ban
  cat >/etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd
[sshd]
enabled = true
EOF
  systemctl enable --now fail2ban
  systemctl restart fail2ban

  # SSH hardening (keep password auth as-is to avoid lockout; disable root pw login)
  local sshd=/etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$sshd"
  sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$sshd"
  sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 4/' "$sshd"
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

  # Docker daemon hardening (log rotation, no new privileges, userland-proxy off)
  mkdir -p /etc/docker
  cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "no-new-privileges": true,
  "live-restore": true
}
EOF
  systemctl restart docker
}

# ----------------------------------------------------------------------------- 7. Generate .env.production
generate_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"
    ok "Created $ENV_FILE from template."
  fi
  quote_env_values_with_spaces "$ENV_FILE"
  load_env


  local now exp
  now=$(date +%s); exp=$((now + 5*365*24*3600))  # ~5 years

  _set() { local k="$1" v="$2"; grep -q "^$k=" "$ENV_FILE" && sed -i "s|^$k=.*|$k=$v|" "$ENV_FILE" || echo "$k=$v" >> "$ENV_FILE"; }

  [[ -z "${POSTGRES_PASSWORD:-}" ]] && { POSTGRES_PASSWORD=$(gen_password); _set POSTGRES_PASSWORD "$POSTGRES_PASSWORD"; }
  [[ -z "${JWT_SECRET:-}"        ]] && { JWT_SECRET=$(gen_secret 32);       _set JWT_SECRET "$JWT_SECRET"; }
  [[ -z "${SECRET_KEY_BASE:-}"   ]] && { _set SECRET_KEY_BASE "$(gen_secret 32)"; }
  # Realtime uses AES-128 for tenant credentials, so this key must be exactly
  # 16 bytes/chars. Earlier installers generated 32 hex chars, which makes the
  # realtime container crash-loop during self-host seeding.
  if [[ -z "${REALTIME_DB_ENC_KEY:-}" || ${#REALTIME_DB_ENC_KEY} -ne 16 ]]; then
    REALTIME_DB_ENC_KEY="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16)"
    _set REALTIME_DB_ENC_KEY "$REALTIME_DB_ENC_KEY"
  fi
  [[ -z "${VAULT_ENC_KEY:-}"     ]] && { _set VAULT_ENC_KEY "$(gen_secret 16)"; }
  [[ -z "${DASHBOARD_PASSWORD:-}" ]] && { _set DASHBOARD_PASSWORD "$(gen_password)"; }
  [[ -z "${ADMIN_PASSWORD:-}" ]] && { ADMIN_PASSWORD=$(gen_password); _set ADMIN_PASSWORD "$ADMIN_PASSWORD"; }
  if [[ -z "${ANON_KEY:-}" ]]; then
    ANON_KEY=$(make_jwt "$JWT_SECRET" anon "$now" "$exp"); _set ANON_KEY "$ANON_KEY"
  fi
  if [[ -z "${SERVICE_ROLE_KEY:-}" ]]; then
    SERVICE_ROLE_KEY=$(make_jwt "$JWT_SECRET" service_role "$now" "$exp"); _set SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
  fi
  # Derived
  _set DATABASE_URL "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}"
  _set SUPABASE_URL "https://${SUPABASE_DOMAIN}"
  _set STORAGE_URL "https://${SUPABASE_DOMAIN}/storage/v1"
  _set SUPABASE_ANON_KEY "$ANON_KEY"
  _set SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
  _set VITE_SUPABASE_URL "https://${SUPABASE_DOMAIN}"
  _set VITE_SUPABASE_ANON_KEY "$ANON_KEY"
  _set VITE_SUPABASE_PUBLISHABLE_KEY "$ANON_KEY"
  chmod 600 "$ENV_FILE"
  ok "Secrets generated/verified in $ENV_FILE"
  load_env
}

# ----------------------------------------------------------------------------- 8. Supabase stack
start_supabase() {
  cd "$DEPLOY_DIR"
  # Render kong.yml with the generated keys
  sed -e "s|\${ANON_KEY}|${ANON_KEY}|g" -e "s|\${SERVICE_ROLE_KEY}|${SERVICE_ROLE_KEY}|g" \
    supabase/kong.yml > supabase/kong.rendered.yml
  cp supabase/kong.rendered.yml supabase/kong.yml
  # Copy edge functions from repo
  if [[ -d "$ROOT_DIR/supabase/functions" ]]; then
    rsync -a "$ROOT_DIR/supabase/functions/" "$DEPLOY_DIR/supabase/functions/" 2>/dev/null || true
  fi
  docker compose --env-file "$ENV_FILE" -f docker-compose.supabase.yml up -d supabase-db
  wait_for_supabase_db
  ensure_supabase_core_roles
  docker compose --env-file "$ENV_FILE" -f docker-compose.supabase.yml up -d
  restart_supabase_platform_services
  wait_for_supabase_platform_schemas
}

# ----------------------------------------------------------------------------- 9. Migrations
run_migrations() { bash "$DEPLOY_DIR/migrate.sh"; }

# ----------------------------------------------------------------------------- 9b. Admin user
seed_admin() { bash "$DEPLOY_DIR/seed-admin.sh"; }

# ----------------------------------------------------------------------------- 9c. Laravel backend sync (optional, same DB)
sync_laravel() {
  local be="$ROOT_DIR/backend"
  [[ -d "$be" ]] || { log "No Laravel backend dir — skipping."; return 0; }
  if ! have php || ! have composer; then
    warn "php/composer not installed — skipping Laravel sync (Supabase schema is source of truth)."
    return 0
  fi
  ( cd "$be"
    composer install --no-dev --optimize-autoloader --no-interaction || true
    [[ -f .env ]] || { [[ -f .env.production.example ]] && cp .env.production.example .env; }
    grep -q '^APP_KEY=base64' .env 2>/dev/null || php artisan key:generate --force || true
    php artisan migrate --force || warn "Laravel migrate reported issues."
    php artisan db:seed --force || warn "Laravel seed reported issues."
  )
  ok "Laravel backend synced with database."
}

# ----------------------------------------------------------------------------- 10. App + proxy
start_app() {
  cd "$DEPLOY_DIR"
  docker compose --env-file "$ENV_FILE" -f docker-compose.yml up -d --build
}

# ----------------------------------------------------------------------------- 11. Backups (cron)
schedule_backups() {
  local cron_line="0 2 * * * /usr/bin/env bash $DEPLOY_DIR/backup.sh >> $LOG_DIR/backup.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "$DEPLOY_DIR/backup.sh" ; echo "$cron_line" ) | crontab -
  ok "Daily backup scheduled at 02:00 (retention ${BACKUP_RETENTION_DAYS:-30}d)."
}

# ----------------------------------------------------------------------------- Run
detect_project
step sys_update      "Updating Ubuntu"                 system_update
step docker          "Installing Docker + Compose"     install_docker
step coolify         "Installing Coolify"              install_coolify
create_network && ok "Docker network mk_net ready"
step firewall        "Configuring UFW firewall"        configure_firewall
step harden          "Hardening server (Fail2ban/SSH/Docker)" harden_server
generate_env
start_supabase    && ok "Supabase stack up"
run_migrations
seed_admin
# Laravel API is NOT deployed now (Coolify + self-hosted Supabase only).
# To sync the Laravel backend later, run manually: SYNC_LARAVEL=1 bash install.sh
[[ "${SYNC_LARAVEL:-0}" == "1" ]] && sync_laravel
start_app         && ok "Application + Caddy up"
schedule_backups

cat <<EOF

${C_GRN}========================================================${C_RST}
 Deployment complete. Services (allow a few minutes for SSL):

   App        ->  https://${APP_DOMAIN}
   Supabase   ->  https://${SUPABASE_DOMAIN}
   Coolify    ->  https://${COOLIFY_DOMAIN}

 App login    : ${ADMIN_EMAIL} / (see ADMIN_PASSWORD in $ENV_FILE)
 Studio login : ${DASHBOARD_USERNAME} / (see DASHBOARD_PASSWORD in $ENV_FILE)
 Secrets file : $ENV_FILE  (chmod 600)
 Logs         : $LOG_DIR/deploy.log
${C_GRN}========================================================${C_RST}

 DNS: point these A records to ${SERVER_IP}:
   ${APP_DOMAIN}  ${SUPABASE_DOMAIN}  ${COOLIFY_DOMAIN}

 Connect GitHub deploy in Coolify (${GIT_REPOSITORY}) using build:
   npm install && npm run build   (never npm ci)
EOF
ok "===== installer finished ====="
