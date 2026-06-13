#!/usr/bin/env bash
# =============================================================================
# deploy/bootstrap.sh — ONE command for a brand-new Ubuntu 24.04 VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/deploy/bootstrap.sh | sudo bash
#
# It installs git, clones (or updates) the repository to /opt/mkbaliadanga,
# then runs the full idempotent installer. Safe to re-run.
# =============================================================================
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/snsbd247/mkbaliadanga-801b0009.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/mkbaliadanga}"

[[ $EUID -eq 0 ]] || { echo "Run as root: curl -fsSL ... | sudo bash"; exit 1; }

echo ">> Installing git…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git

if [[ -d "$APP_DIR/.git" ]]; then
  echo ">> Updating existing repo at $APP_DIR…"
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" checkout "$REPO_BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
else
  echo ">> Cloning repo into $APP_DIR…"
  rm -rf "$APP_DIR"
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo ">> Running installer…"
cd "$APP_DIR/deploy"
exec bash install.sh
