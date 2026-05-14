# Phase 4 — Production Switchover (Supabase → Laravel API)

This phase flips the application's primary data plane from the legacy Supabase
backend to the new Laravel API in `backend/`.

## 4.1 — API stack scaffolding (done)

- `src/pages/ApiDashboard.tsx` — tile landing page
- `src/lib/api/featureFlag.ts` — `VITE_USE_API` flag + legacy→API redirect map
- `src/App.tsx` — routes `/api`, `/api/dashboard`; conditional root redirect

## 4.2 — Hard cutover, keep code (done)

**Default behaviour:** `USE_API_BACKEND = true` unless `VITE_USE_API=0`.

When the flag is on:
- `/` → `/api/dashboard`
- Legacy top-level paths (`/auth`, `/dashboard`, `/farmers`, `/loans`, …) → `/api/*`
- All other legacy routes still mount (covered by `AppLayout`) — emergency only

When the flag is off (`VITE_USE_API=0`):
- App behaves exactly like before — full Supabase stack, no redirects.

### Legacy → API redirect map

See `LEGACY_TO_API` in `src/lib/api/featureFlag.ts`. Now covers core auth/admin
paths plus extended mappings (Phase 4.2.1): `/lands`, `/assets`,
`/irrigation`, `/irrigation/invoices`, `/irrigation/collect`, `/scan`,
`/scan-payment`, `/cashbook`, `/statement`, `/dues`, `/financial-reports`,
`/ledger`, `/ledger-integrity`, `/approvals`, `/period-close`,
`/finance-summary`, `/share-collection`, `/sms-settings`, `/voters`,
`/import`, `/farmers/import`.

Add more entries to the map as you finish migrating individual screens.

## 4.2.2 — Pre-deployment readiness (current)

### Backend checklist

- [ ] `backend/.env` populated (APP_KEY, DB, SANCTUM_STATEFUL_DOMAINS, CORS_ALLOWED_ORIGINS, MAIL/SMS, QUEUE)
- [ ] `docker compose up -d --build` green (php-fpm, nginx, postgres, redis, queue, scheduler)
- [ ] `php artisan migrate --force` clean
- [ ] `php artisan db:seed --class=RolesPermissionsSeeder`
- [ ] `php artisan db:seed --class=ChartOfAccountsSeeder`
- [ ] `php artisan db:seed --class=AdminUserSeeder` (creates first super_admin)
- [ ] `php artisan integrity:scan` returns 0 issues
- [ ] HTTPS in front of nginx; `/api/auth/login` returns 200 from outside

### Smoke test

```bash
API_URL=https://api.mohammadkhani.com/api \
API_EMAIL=admin@mohammadkhani.com \
ADMIN_PASSWORD=… \
node scripts/api-smoke.mjs
```

Exits non-zero on any 4xx/5xx. Run before pointing the frontend at the new API.

CI runs this automatically when these GitHub secrets are set:
`API_SMOKE_URL`, `API_SMOKE_EMAIL`, `API_SMOKE_PASSWORD` (job: `api-smoke`).

### Frontend checklist

- [ ] `VITE_API_URL` set to the live API base (`…/api`)
- [ ] `VITE_USE_API=1` (or unset — default on)
- [ ] `bun run build` succeeds
- [ ] Manual flow: `/` → `/api/dashboard` → login → 18 tiles load → create one journal

## Deployment

1. Deploy Laravel backend (see checklist above).
2. Run `scripts/api-smoke.mjs` against the public URL.
3. Build & deploy frontend.
4. Watch `backend/storage/logs/laravel.log` and browser console for the first hour.

## Emergency rollback

Set `VITE_USE_API=0`, rebuild, redeploy. Root and all legacy paths return to
the Supabase stack instantly. No data is touched.

## Data migration (one-time, before first cutover)

| Step | Command |
|---|---|
| Export Supabase | `supabase db dump -f supabase.sql` |
| Restore to Laravel DB | `psql $LARAVEL_DB < migrate/transformed.sql` |
| Reset sequences | `php artisan db:seed --class=SequenceFixSeeder` |
| Verify counts | `php artisan integrity:scan` |

Archive parity report at `docs/migration-report-YYYY-MM-DD.md`.

## Phase 4.3 (future, after ≥7 days stable in production)

- Delete `src/integrations/supabase/*` and remove `@supabase/supabase-js`
- Remove legacy `AuthProvider`, `AppLayout`, all legacy pages
- Decommission edge functions via `supabase--delete_edge_functions`
- Drop `supabase/config.toml`
