#!/usr/bin/env bash
# =============================================================================
# deploy/update.sh — pull latest code, re-apply migrations, rebuild app.
# Takes a safety backup first. Idempotent. Build uses npm install (never npm ci).
#   sudo bash update.sh
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
need_root
load_env

log "===== Update started ====="

# 1) Safety backup
bash "$DEPLOY_DIR/backup.sh" || warn "Pre-update backup failed — continuing cautiously."

# 2) Pull latest code
if [[ -d "$ROOT_DIR/.git" ]]; then
  log "Pulling latest from ${GIT_BRANCH:-main}…"
  git -C "$ROOT_DIR" fetch --all --prune
  git -C "$ROOT_DIR" reset --hard "origin/${GIT_BRANCH:-main}"
  ok "Code updated to $(git -C "$ROOT_DIR" rev-parse --short HEAD)"
else
  warn "Not a git checkout — skipping code pull."
fi

# 3) Update Supabase stack (pull newer images if any)
cd "$DEPLOY_DIR"
docker compose --env-file "$ENV_FILE" -f docker-compose.supabase.yml pull || true
docker compose --env-file "$ENV_FILE" -f docker-compose.supabase.yml up -d

# 4) Apply any new migrations
bash "$DEPLOY_DIR/migrate.sh"

# 5) Rebuild & restart the app (npm install + npm run build via Dockerfile.app)
docker compose --env-file "$ENV_FILE" -f docker-compose.yml up -d --build

# 6) Prune dangling images
docker image prune -f >/dev/null 2>&1 || true

ok "===== Update complete ====="
bash "$DEPLOY_DIR/health-check.sh" || warn "Post-update health check reported issues."
