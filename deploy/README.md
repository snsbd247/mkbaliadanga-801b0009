# MK Baliadanga — Automated VPS Deployment (Coolify + Self-Hosted Supabase)

Production-grade, **idempotent** deployment package for the Lovable/Vite/React app
with a fully self-hosted Supabase stack, Coolify, automatic SSL, hardening,
daily backups, restore, and health monitoring.

| Item | Value |
|------|-------|
| Server IP | `144.79.249.145` |
| Base domain | `mohammadkhani.com` |
| Admin email | `ismailsagor162@gmail.com` |
| Repository | `https://github.com/snsbd247/mkbaliadanga-801b0009.git` |

## Final URLs

```
https://app.mohammadkhani.com         # React application
https://supabase.mohammadkhani.com    # Supabase API + Studio (Kong gateway)
https://coolify.mohammadkhani.com     # Coolify dashboard
```

---

## 1. Prerequisites (DNS)

Point these **A records** to `144.79.249.145`:

```
app.mohammadkhani.com        A   144.79.249.145
supabase.mohammadkhani.com   A   144.79.249.145
coolify.mohammadkhani.com    A   144.79.249.145
```

SSL is issued automatically by Caddy (Let's Encrypt) once DNS resolves.

## 2. One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/deploy/bootstrap.sh | sudo bash
```

The installer is **safe to re-run**. Completed steps are tracked in
`/var/lib/mkbaliadanga/` and skipped on subsequent runs.

If the repository is already cloned on the VPS, run it from the deploy folder:

```bash
cd /opt/mkbaliadanga/deploy
sudo bash install.sh
```

### What `install.sh` does
1. Analyzes the repo (Vite, React, TypeScript, Supabase client, Edge Functions, env).
2. Updates Ubuntu and installs Docker + Compose plugin.
3. Installs **Coolify** (latest stable).
4. Creates the `mk_net` Docker network.
5. Configures **UFW** firewall, **Fail2ban**, **SSH** + **Docker** hardening.
6. Generates `.env.production` with strong secrets and valid Supabase **JWT** keys
   (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DATABASE_URL`, `STORAGE_URL`).
7. Brings up the **self-hosted Supabase** stack
   (PostgreSQL, Kong, Auth, REST, Realtime, Storage, Studio, Meta, Edge Functions, imgproxy).
8. Imports your **schema, RLS, triggers, functions, indexes, and seed** (`migrate.sh`).
9. Builds and serves the app (`npm install && npm run build` — **never `npm ci`**).
10. Starts the **Caddy** reverse proxy with automatic SSL + renewal.
11. Schedules **daily backups** (cron, 02:00) with 30-day retention.

---

## 3. Files

| File | Purpose |
|------|---------|
| `install.sh` | One-command, idempotent installer (orchestrator) |
| `update.sh` | Pull code, re-migrate, rebuild app (auto-backup first) |
| `backup.sh` | Daily backup: PostgreSQL + Storage + env (30-day retention) |
| `restore.sh` | Full system restore from a backup directory or `latest` |
| `health-check.sh` | Verifies PostgreSQL, Supabase, Coolify, Application |
| `migrate.sh` | Imports Supabase migrations + seed; tracked & idempotent |
| `docker-compose.yml` | App + Caddy reverse proxy (SSL) |
| `docker-compose.supabase.yml` | Full self-hosted Supabase stack |
| `Dockerfile.app` | Multi-stage Vite build → nginx static serve |
| `Caddyfile` | Automatic HTTPS for the 3 subdomains |
| `supabase/kong.yml` | Kong declarative gateway config |
| `supabase/functions/main/` | Edge runtime router |
| `.env.example` | Template for `.env.production` |
| `lib/common.sh` | Shared logging/idempotency/JWT helpers |

---

## 4. Common operations

```bash
# Enter the repo first if needed
cd /home/mkadmin/mkbaliadanga-801b0009

# Health check
sudo bash deploy/health-check.sh

# Manual backup
sudo bash deploy/backup.sh

# Restore (latest or a specific stamp)
sudo bash deploy/restore.sh latest
sudo bash deploy/restore.sh /opt/mkbaliadanga-backups/20260613-020000

# Update to newest code + images
sudo bash deploy/update.sh

# Run/re-run database migrations only
sudo bash deploy/migrate.sh

# Export from a source backend before VPS restore
export SUPABASE_URL="https://supabase.mohammadkhani.com"
export CRON_SECRET="<configured-export-secret>"
sudo bash scripts/restore-vps.sh --mode full

# Tail logs
tail -f /var/log/mkbaliadanga/deploy.log
```

---

## 5. Coolify GitHub auto-deploy (optional)

`install.sh` brings the app up directly via Docker. To manage it through Coolify
instead:

1. Open `https://coolify.mohammadkhani.com`, finish the first-run admin setup.
2. **Sources → GitHub** → connect `snsbd247/mkbaliadanga-801b0009`.
3. **New Resource → Application** (Nixpacks/Dockerfile), branch `main`.
4. Build command: `npm install && npm run build`  ·  Output dir: `dist`.
5. Set env vars from `.env.production` (at least `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`).
6. Domain: `app.mohammadkhani.com`.

> Never use `npm ci`. Always `npm install`.

---

## 6. Security notes

- All secrets live in `deploy/.env.production` (`chmod 600`, git-ignored).
- `SERVICE_ROLE_KEY` and the DB password are never logged or echoed.
- UFW allows only `22, 80, 443, 8000`. Fail2ban guards SSH.
- Rotate keys by clearing the relevant values in `.env.production` and re-running
  `install.sh` (it regenerates only empty values).
