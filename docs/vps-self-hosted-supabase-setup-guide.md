# MK Baliadanga VPS Setup Guide

## Goal

Deploy the existing Lovable/Vite/React application on an Ubuntu 24.04 VPS while preserving Lovable Preview compatibility. The application must use environment-based backend configuration only:

- Lovable Preview uses the preview environment values injected by Lovable.
- Local development uses `.env.local` values.
- Production VPS uses the self-hosted backend at `https://supabase.mohammadkhani.com`.

No business logic, RLS rules, reports, PDF generation, QR verification, SMS workflows, Farmer Portal, accounting, storage, or audit-log behavior is changed by the deployment package.

## Infrastructure

| Item | Value |
|---|---|
| Server IP | `144.79.249.145` |
| Base domain | `mohammadkhani.com` |
| App URL | `https://app.mohammadkhani.com` |
| Self-hosted backend URL | `https://supabase.mohammadkhani.com` |
| Coolify URL | `https://coolify.mohammadkhani.com` |
| Admin email | `ismailsagor162@gmail.com` |
| Repository | `https://github.com/snsbd247/mkbaliadanga-801b0009.git` |

## DNS records

Create these A records before installation:

```text
app.mohammadkhani.com        A   144.79.249.145
supabase.mohammadkhani.com   A   144.79.249.145
coolify.mohammadkhani.com    A   144.79.249.145
```

SSL certificates are issued automatically after DNS resolves.

## One-command installation

Run on a fresh Ubuntu 24.04 VPS:

```bash
sudo apt-get update -y
sudo apt-get install -y git
git clone https://github.com/snsbd247/mkbaliadanga-801b0009.git
cd mkbaliadanga-801b0009/deploy
sudo bash install.sh
```

The installer is idempotent and safe to re-run.

## What the installer does

1. Detects Vite, React, TypeScript, backend client usage, Edge Functions, and migrations.
2. Installs Docker, Docker Compose plugin, Coolify, UFW, Fail2ban, cron, git, jq, rsync, and OpenSSL.
3. Generates `deploy/.env.production` with strong production secrets.
4. Starts the self-hosted backend stack: PostgreSQL, Auth, REST, Realtime, Storage, Studio, Meta, Edge Runtime, Kong, and imgproxy.
5. Applies database migrations in order and records them in `public.schema_migrations`.
6. Sets database runtime values so trigger-fired SMS calls use the VPS backend URL and anon key.
7. Builds the React app with `npm install && npm run build` only.
8. Starts Caddy for HTTPS reverse proxy.
9. Schedules daily backups with retention.

## Environment model

### Lovable Preview

Lovable Preview reads:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

These values are injected by Lovable. No source code contains a fixed backend URL or fixed anon key.

### Local development

Create `.env.local` from `.env.local.example`:

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Edit only `.env.local` when switching between local and preview backend values.

### Production VPS

The installer generates `deploy/.env.production`. The production build uses:

```text
VITE_SUPABASE_URL=https://supabase.mohammadkhani.com
VITE_SUPABASE_PUBLISHABLE_KEY=<generated anon key>
VITE_SUPABASE_ANON_KEY=<generated anon key>
SUPABASE_URL=https://supabase.mohammadkhani.com
SUPABASE_ANON_KEY=<generated anon key>
SUPABASE_SERVICE_ROLE_KEY=<generated service role key>
```

Do not commit `deploy/.env.production`.

## Required commands

### Health check

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/health-check.sh
```

### Backup

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/backup.sh
```

Backups are stored under:

```text
/opt/mkbaliadanga-backups
```

### Restore from latest backup

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/restore.sh latest
```

### Restore from a specific backup

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/restore.sh /opt/mkbaliadanga-backups/YYYYMMDD-HHMMSS
```

### Apply migrations only

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/migrate.sh
```

### Update application

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/update.sh
```

### Tail logs

```bash
tail -f /var/log/mkbaliadanga/deploy.log
docker logs -f mk_app
docker logs -f supabase-kong
docker logs -f supabase-functions
docker logs -f supabase-db
```

## Migration from Lovable Preview backend to VPS backend

Use the existing export function only when moving data from a source backend into the VPS backend.

```bash
export SUPABASE_URL="<source-backend-url>"
export CRON_SECRET="<configured-export-secret>"
sudo bash scripts/restore-vps.sh --mode full
```

For local SQL file restore:

```bash
sudo bash scripts/restore-vps.sh --file /path/to/backup.sql
```

The script no longer falls back to any fixed backend URL; `SUPABASE_URL` must be provided when downloading a backup.

## Module validation checklist

After deployment, verify these modules without changing business data unexpectedly:

- Authentication: staff login, logout, session refresh, protected routes.
- Farmer Portal: OTP/password login, dashboard data, farmer card, QR token flow.
- RLS: staff-only pages should require login; farmer portal should expose only allowed farmer data.
- Storage: upload, view, and download any existing document/image flows.
- Reports: irrigation reports, savings reports, loan reports, ledger/accounting reports.
- PDF generation: receipts, cards, invoices, reports.
- QR verification: scan, resolve token, receipt verification.
- SMS integration: provider settings, test SMS, queued SMS, retry flow, due reminders.
- Accounting: cashbook, bank accounts, bank transactions, ledger, journal entries, reconciliation.
- Audit logs: user actions, permission changes, import logs, system events.
- Backups: manual backup and latest restore dry-run on a non-production copy first.

## Files modified for environment compatibility

- `supabase/migrations/20260502080142_24e4b61f-ad57-4d7e-8733-a3148dc9602c.sql`
- `supabase/migrations/20260502081337_e98a98ea-4fba-4c0c-8b16-a8a2eb95474f.sql`
- `supabase/migrations/20260613181514_b8777db4-48d2-47de-94e3-74b90e7e3375.sql`
- `deploy/.env.example`
- `deploy/install.sh`
- `deploy/migrate.sh`
- `deploy/docker-compose.supabase.yml`
- `deploy/README.md`
- `.env.preview.example`
- `scripts/restore-vps.sh`

## Hardcoded values removed

- Removed fixed backend URL fallback from historical SMS queue migrations.
- Removed fixed anon-key fallback from historical SMS queue migrations.
- Removed fixed source backend fallback from `scripts/restore-vps.sh`.
- Replaced fixed Realtime DB encryption key with generated `REALTIME_DB_ENC_KEY`.

## Deployment readiness status

Ready for Ubuntu 24.04 VPS deployment after DNS records resolve.

Run this final check before going live:

```bash
cd /home/mkadmin/mkbaliadanga-801b0009
sudo bash deploy/health-check.sh
```

## Keeping the Laravel Backend In Sync (Dual Backend)

This repo ships **two backends that share one PostgreSQL database**:

1. **Self-hosted Supabase** — the primary backend the React app talks to. Schema
   lives in `supabase/migrations/*.sql` and is applied by `deploy/migrate.sh`
   during `install.sh` / `bootstrap.sh`.
2. **Laravel API** (`backend/`) — a parallel API kept structurally in sync with
   the same tables. Its schema lives in `backend/database/migrations/`.

The migration `backend/database/migrations/2026_06_13_000002_sync_supabase_schema.php`
mirrors every public table from Supabase (105 tables) into the Laravel schema and
is **idempotent** — each table is guarded by `Schema::hasTable()`, so it is safe to
run against a database that Supabase migrations already created.

### Run / re-sync the Laravel backend

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.production.example .env        # set DB_* to the self-hosted Postgres
php artisan key:generate
php artisan migrate --force            # applies only missing tables
php artisan db:seed --force            # roles, geo, chart of accounts, admin
```

> Because both backends point at the same database, run only **one** set of
> structural migrations as the source of truth (Supabase via `deploy/migrate.sh`).
> The Laravel `migrate` then becomes a no-op for existing tables and only fills
> any gap, keeping Eloquent models (`backend/app/Models/`) aligned with the live
> schema.
