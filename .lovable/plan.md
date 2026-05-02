# Plan: Audit Export, Receipts, QR Rotation, Reconciliation

Four focused enhancements that build on existing modules without breaking them.

---

## 1. AuditLogs CSV — Localized Headers & Consistent Names

**File**: `src/pages/AuditLogs.tsx`

- Detect current language from `i18n` (existing `useTranslation` hook).
- Add bilingual header map:
  ```
  date | তারিখ
  action | কার্যক্রম
  entity | বিষয়
  office | অফিস
  farmer_code | কৃষক কোড
  farmer_name | কৃষকের নাম
  user | ব্যবহারকারী
  details | বিবরণ
  ```
- Pre-fetch maps for offices (`id → name`) and farmers (`id → {code, name_en, name_bn}`) for rows currently displayed, then build the CSV from those maps so names are consistent (no raw UUIDs).
- UTF-8 BOM prefix so Excel renders Bangla correctly.

---

## 2. PDF Receipt After Successful Scan Payment

**Files**:
- New: `src/lib/paymentReceiptPdf.ts` (jsPDF — already a dependency)
- Edit: `src/pages/ScanPayment.tsx`

After a successful payment insert:
- Build a receipt object: `{ receipt_no (payment.id short), date, farmer (code+name), token (masked, e.g. `mkc_…last4`), token_status: 'active', kind, amount, method, collected_by, idempotency_key }`.
- Auto-generate PDF (A5) and offer **Download Receipt** button on the success card.
- Reuse the existing success/failure UI; do not change submission logic.

---

## 3. Scheduled QR Token Rotation (Admin)

**DB migration**:
- New table `qr_rotation_settings` (single row id=1):
  - `enabled boolean`, `interval_days int default 90`, `grace_hours int default 24`, `last_run_at timestamptz`, `updated_by uuid`.
  - RLS: read for authenticated; manage by super_admin.
- Add `expires_at timestamptz` and `rotated_from uuid` (nullable) to `qr_tokens` for safe overlap.

**New edge function**: `qr-rotate-scheduled` (service role)
- For every farmer with an active token older than `interval_days`:
  1. Issue a new token (reuse logic from `farmer-card-token`).
  2. Set old token `expires_at = now() + grace_hours` (do not revoke immediately — allows in-flight cards to keep working briefly).
  3. After grace window, mark expired tokens `revoked = true`.
- Log each rotation in `audit_logs` (`entity='qr_tokens'`, `action='rotate'|'revoke'`).

**Update `qr-resolve-token`**: treat tokens with `expires_at < now()` OR `revoked = true` as `410 Gone`.

**Cron**: schedule `qr-rotate-scheduled` daily via `pg_cron + pg_net` (using `supabase--insert`, not migration, since it embeds the anon key).

**Admin UI**: New section in `src/pages/Settings.tsx` (or new `/admin/qr-rotation`) with toggle, interval, grace-hours, "Run now" button (calls function), and last-run timestamp.

---

## 4. Monthly Ledger Reconciliation Report

**New edge function**: `ledger-reconcile-monthly`
- Inputs: `{ year, month, office_id? }`
- Computes per office:
  - Opening balance per account (sum of ledger before month start).
  - Period debits/credits per account.
  - Closing balance.
  - Mismatches: unbalanced refs (`ledger_unbalanced_refs`) within month, orphan refs (`ledger_orphan_refs`), and any reference whose source-table sum (loans/payments/savings/irrigation/expenses) ≠ posted ledger sum.
- Returns JSON with `accounts[]`, `mismatches[]`, `summary {total_debit,total_credit,diff}`.

**New page**: `src/pages/LedgerReconciliation.tsx` (route `/admin/reconciliation`, admin/super_admin only)
- Filters: month picker, office select.
- Table of accounts with opening/debit/credit/closing.
- Highlighted mismatches panel (red badges).
- Export buttons:
  - **CSV** — bilingual headers, BOM, includes mismatches as second section.
  - **PDF** — using jsPDF autotable: header (office, period), summary, accounts table, mismatches table.

Add link in admin sidebar.

---

## Technical Notes

- All edge functions: service-role client, CORS headers from `@supabase/supabase-js/cors`, Zod validation, JWT check for admin endpoints.
- No changes to existing trigger logic — reconciliation is read-only.
- Reuse `jsPDF` (already used by `cardPdf.ts`); add `jspdf-autotable` if not present.
- Audit logging continues via existing `audit_trigger` for new table writes.

## Files Touched

**Created**
- `src/lib/paymentReceiptPdf.ts`
- `src/pages/LedgerReconciliation.tsx`
- `supabase/functions/qr-rotate-scheduled/index.ts`
- `supabase/functions/ledger-reconcile-monthly/index.ts`
- 2 migrations (qr_rotation_settings + qr_tokens columns)

**Edited**
- `src/pages/AuditLogs.tsx` (CSV localization)
- `src/pages/ScanPayment.tsx` (receipt button)
- `src/pages/Settings.tsx` (QR rotation admin panel)
- `src/App.tsx` (new route + sidebar link)
- `supabase/functions/qr-resolve-token/index.ts` (expires_at check)
- `supabase/config.toml` (function entries)

Awaiting approval to proceed.
