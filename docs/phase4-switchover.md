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

## Deployment

1. Deploy Laravel backend (`backend/docker compose up -d --build`); run
   `php artisan migrate --seed --force` and `db:seed --class=AdminUserSeeder`.
2. Frontend env:
   ```env
   VITE_API_URL=https://api.mohammadkhani.com/api
   # VITE_USE_API=1  # default; omit unless you need to disable
   ```
3. `bun run build` → upload `dist/`.
4. Smoke test: `/` → `/api/dashboard` → login → tiles load → create one journal.

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
