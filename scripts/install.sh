#!/usr/bin/env bash
# Bootstrap wrapper for legacy one-command installs.
# Purpose: if anyone still runs install.sh (including old curl URLs), always
# hand off to the latest repo copy of setup.sh so fresh VPS installs use the
# current logic: phpMyAdmin, both admin users, auth repairs, and full logs.

set -euo pipefail

DOMAIN="${DOMAIN:-mohammadkhani.com}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO="${REPO:-https://github.com/snsbd247/mkbaliadanga-801b0009.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/mk}"

log()  { echo -e "\n\033[1;32m[+] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (use sudo)."
export DEBIAN_FRONTEND=noninteractive

log "Preparing latest setup.sh bootstrap…"
apt-get update -y
apt-get install -y git curl ca-certificates

if [ -d "${APP_DIR}/.git" ]; then
  git config --global --add safe.directory "${APP_DIR}" || true
  git -C "${APP_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
else
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --depth 1 -b "${BRANCH}" "${REPO}" "${APP_DIR}"
  git config --global --add safe.directory "${APP_DIR}" || true
fi

exec bash "${APP_DIR}/scripts/setup.sh"
