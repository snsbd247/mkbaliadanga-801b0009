#!/usr/bin/env bash
#
# MK Cooperative ERP — backend test runner
# ========================================
# Installs composer dependencies if missing, then runs the PHPUnit suite
# against an in-memory SQLite database so the RPC/admin-users fixes are
# continuously verified in CI and locally.
#
# USAGE:
#   bash backend/scripts/run-tests.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${SCRIPT_DIR}"

echo "[+] Working dir: ${SCRIPT_DIR}"

if ! command -v php >/dev/null 2>&1; then
  echo "[x] PHP is not installed. Install PHP 8.2+ before running tests." >&2
  exit 1
fi

# Install composer if it is not on PATH.
if ! command -v composer >/dev/null 2>&1; then
  echo "[+] composer not found — installing locally…"
  php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
  php composer-setup.php --install-dir=. --filename=composer
  rm -f composer-setup.php
  COMPOSER="php ${SCRIPT_DIR}/composer"
else
  COMPOSER="composer"
fi

# Install dependencies (including dev) if vendor/ is missing.
if [ ! -f vendor/bin/phpunit ]; then
  echo "[+] Installing composer dependencies (with dev)…"
  ${COMPOSER} install --no-interaction --prefer-dist
fi

echo "[+] Running PHPUnit against in-memory SQLite…"
DB_CONNECTION=sqlite DB_DATABASE=:memory: php vendor/bin/phpunit "$@"
