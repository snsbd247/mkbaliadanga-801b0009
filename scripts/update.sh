#!/usr/bin/env bash
# Update MK Baliadanga to latest main branch.
set -euo pipefail
APP_DIR="${APP_DIR:-/home/mkadmin/mkbaliadanga}"
cd "$APP_DIR"

echo "[mk] Pulling latest code..."
git config --global --add safe.directory "$APP_DIR" || true
git fetch --all
git reset --hard origin/main

cd "$APP_DIR/infra"
echo "[mk] Pulling images + rebuilding..."
docker compose --env-file "$APP_DIR/.env" pull
docker compose --env-file "$APP_DIR/.env" up -d --build

echo "[mk] Running pending migrations..."
docker compose exec -T api pnpm prisma migrate deploy

echo "[mk] Clearing app caches..."
docker compose exec -T api node dist/scripts/cache-clear.js || true

echo "[mk] Update complete."
bash "$APP_DIR/scripts/healthcheck.sh"
