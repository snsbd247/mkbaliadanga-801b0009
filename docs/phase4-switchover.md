# Phase 4 — Production Switchover (Supabase → Laravel API)

This phase flips the application's primary data plane from the legacy Supabase
backend to the new Laravel API in `backend/`. Legacy routes remain available
for fallback; nothing is deleted yet.

## What's added in 4.1

| File | Purpose |
|---|---|
| `src/pages/ApiDashboard.tsx` | Tile-based landing page for the API stack |
| `src/lib/api/featureFlag.ts` | `VITE_USE_API` env flag → flips root `/` |
| `src/App.tsx` | New routes `/api`, `/api/dashboard`; conditional root redirect |

## How to switch a deployment to the API stack

1. **Deploy the Laravel backend** (`backend/`)
   ```bash
   cd backend
   docker compose up -d --build
   docker compose exec app php artisan migrate --seed --force
   docker compose exec app php artisan db:seed --class=AdminUserSeeder
   ```

2. **Set frontend env**
   ```env
   VITE_API_URL=https://api.mohammadkhani.com/api
   VITE_USE_API=1
   ```

3. **Build & deploy the SPA** — `bun run build` → upload `dist/`.

4. **Smoke test** in this order:
   - `/api/auth` → login as admin
   - `/api/dashboard` loads tiles
   - `/api/farmers` list returns rows
   - `/api/journals` create a balanced entry
   - `/api/reports` → Trial Balance loads

## Rollback

Set `VITE_USE_API=0` (or remove it) and rebuild. Root `/` will return to the
legacy Supabase Farmer Portal login. No data migration is reversed.

## Data migration (one-time, before switchover)

Use these scripts on the production Supabase DB → Laravel Postgres:

| Step | Command | Notes |
|---|---|---|
| Export Supabase | `supabase db dump -f supabase.sql` | Schema + data |
| Restore to Laravel DB | `psql $LARAVEL_DB < migrate/transformed.sql` | After running the table-by-table mapper |
| Reset sequences | `php artisan db:seed --class=SequenceFixSeeder` | Aligns auto-increment / UUID gen |
| Verify counts | `php artisan integrity:scan` | From `IntegrityScanCommand` |

A row-count parity report should be archived in `docs/migration-report-YYYY-MM-DD.md`.

## What is NOT removed yet

- `src/integrations/supabase/*` — still imported by ~150 legacy pages
- `supabase/functions/*` — edge functions stay deployed for fallback
- Legacy `AuthProvider` — wraps the legacy AppLayout

These stay until **Phase 4.2** (legacy decommission) once the API stack runs
clean for ≥7 days in production.

## Phase 4.2 (next, on user approval)

- Remove `AuthProvider` (legacy) and `src/integrations/supabase/*`
- Delete unused legacy pages no longer linked from any nav
- Drop the Supabase project from `package.json`
- Decommission edge functions
