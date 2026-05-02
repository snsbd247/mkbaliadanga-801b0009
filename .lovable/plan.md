
## Goal
Ship 5 enhancements on top of the existing Farmer Portal / QR / CRUD work — without touching any unrelated module.

---

## 1. Admin: Revoke Farmer QR Token

**UI (`src/pages/FarmerCard.tsx`)**
- Add a "Revoke active token" button (admin / super_admin only) next to the existing card actions.
- Confirm with `AlertDialog`. On success, immediately re-issue is optional via existing "Generate new token" flow.

**Edge function (new): `supabase/functions/farmer-card-revoke/index.ts`**
- Auth: JWT validated in-code; require role `admin` or `super_admin` via `user_roles`.
- Action: `UPDATE qr_tokens SET revoked = true WHERE farmer_id = $1 AND revoked = false`.
- Writes an `audit_logs` row: `entity='qr_tokens', action='revoke', meta={farmer_id, count}`.

**Block further scans**
- Update `qr-resolve-token`: already filters `revoked = false`. Add explicit 410 Gone response with `{ error: 'token_revoked' }` when token row exists but `revoked = true`, so the scanner shows a clear message.

---

## 2. Selectable Membership Card Templates

**New: `src/components/card/templates/`**
- `ClassicTemplate.tsx` (current look — green gradient, sans-serif)
- `MinimalTemplate.tsx` (white, mono-ish, minimal)
- `BilingualTemplate.tsx` (BN-prominent, larger Noto Serif Bengali heading)

Each exports the same props (`{ farmer, qrDataUrl }`) and renders inside the existing CR80 frame.

**`src/pages/FarmerCard.tsx`**
- Template selector (`Select`) persisted in `localStorage` per-user.
- Live preview swaps to chosen template.

**`src/components/card/cardPdf.ts`**
- Accept `templateId` param. Render the chosen React template into an offscreen node, then `html2canvas` → `jsPDF` (already in stack) so PDF matches what the user sees. Keep CR80 dimensions.

---

## 3. Scan Payment: Dedupe + Clear Feedback

**Frontend (`src/pages/ScanPayment.tsx`)**
- Generate a deterministic `idempotency_key`: `sha256(token + farmer_id + amount + kind + window_minute)` where `window_minute = floor(Date.now() / 60_000)`.
- Send as `Idempotency-Key` header AND `idempotency_key` column in `payments` insert.
- Disable submit button while pending; show `<Alert variant="success">` (receipt no, amount, farmer) on success and `<Alert variant="destructive">` on failure with translated error.

**DB (migration)**
- Add `UNIQUE INDEX payments_idem_key_uniq ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;` (column already exists).
- On unique-violation insert, surface `409 duplicate_payment` from the existing payment edge path (or catch `23505` client-side and show "Payment already recorded in the last minute").

---

## 4. Audit Logs: Filter + Export

**New page: `src/pages/AuditLogs.tsx`** (admin / super_admin only, route `/admin/audit-logs`)
- Filters: office (select), farmer (search by code/name → resolves to `entity_id`), entity (`qr_tokens | payments | farmers | loans | savings_transactions | irrigation_charges`), action, date range.
- Server-side query against `audit_logs` with RLS already in place (super_admin only). For admin without super_admin we'll relax via a new policy: `is_admin_or_super` can read own office.
- Table view + CSV export (client-side, current filtered set, capped at 5000 rows, paginated fetch).
- Sidebar entry under Admin section.

**Migration**
- Add policy: `admin read office audit` → `is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR has_role(auth.uid(),'super_admin'))`.

---

## 5. E2E Tests: RBAC for delete + ledger consistency

**Playwright (`e2e/rbac-delete.spec.ts`)**
Uses test users seeded via existing auth flow (env: `E2E_STAFF_EMAIL`, `E2E_COMMITTEE_EMAIL`, `E2E_SUPER_EMAIL`, shared password).
- staff login → loan delete button hidden / API returns 403 (RLS).
- committee login → delete loan + delete savings succeed.
- After each delete, query `ledger_entries` via a small read-only edge fn `ledger-check` (or direct supabase-js with anon + RLS) and assert: no rows remain with `(reference_type, reference_id) = (deleted_ref)`; sum(debit) == sum(credit) globally for affected office.

**Helper edge fn (new): `supabase/functions/ledger-check/index.ts`**
- Validates JWT, returns `{ orphan: [...], unbalanced: [...] }` using existing `ledger_orphan_refs()` and `ledger_unbalanced_refs()` SQL functions.

---

## Files

**New**
- `supabase/functions/farmer-card-revoke/index.ts`
- `supabase/functions/ledger-check/index.ts`
- `supabase/migrations/<ts>_payments_idem_unique_audit_policy.sql`
- `src/components/card/templates/{Classic,Minimal,Bilingual}Template.tsx`
- `src/pages/AuditLogs.tsx`
- `e2e/rbac-delete.spec.ts`

**Edited**
- `src/pages/FarmerCard.tsx` (revoke button + template picker)
- `src/components/card/cardPdf.ts` (template-aware render)
- `src/pages/ScanPayment.tsx` (idempotency + feedback)
- `supabase/functions/qr-resolve-token/index.ts` (410 on revoked)
- `src/App.tsx` + `src/components/layout/AppSidebar.tsx` (audit logs route)

## Out of scope
- Re-architecting payments table or ledger triggers
- Adding new roles
- Rewriting existing Vitest suites

Approve to proceed.
