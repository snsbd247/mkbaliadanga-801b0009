# End-to-end tests (Playwright)

These tests exercise RBAC and ledger consistency against a live deployment.
They are **opt-in**: nothing here runs in the default Vitest CI step.

## Run locally

```bash
bun add -d @playwright/test
bunx playwright install chromium

# Required env vars
export E2E_BASE_URL="https://id-preview--…lovable.app"
export E2E_STAFF_EMAIL="staff@example.com"
export E2E_COMMITTEE_EMAIL="committee@example.com"
export E2E_PASSWORD="…"
# Already in .env – mirror them so Playwright sees them:
export VITE_SUPABASE_URL=…
export VITE_SUPABASE_PUBLISHABLE_KEY=…

bunx playwright test
```

## What `rbac-delete.spec.ts` verifies

1. Staff users **cannot** delete loans (RLS denies).
2. Committee/super-admin users **can** delete loans, and after deletion the
   ledger entries that referenced that loan are gone (no orphans, no unbalanced
   refs) – verified via the `ledger-check` edge function.
3. Same flow for savings transactions.
