# Plan: Land Detail, Import UX & Audit, Ledger Verification

This plan adds five capabilities. They're independent and can be reviewed/built incrementally, but I'll ship them together.

---

## 1. Land Detail Page (`/lands/:id`)

New route + page showing a single land parcel with:
- Land info: dag_no, mouza, size, field_type, owner_type, location chain (via `lands_with_location` view)
- Current owner (from `lands.farmer_id`)
- **All `land_relations` for this land**: owner ↔ sharecropper, share %, valid_from/to, status (active/historic), notes
- Per-period total share % with a visual warning when active relations exceed 100%
- Linked irrigation charges summary for the land (read-only list)

Files:
- New `src/pages/LandDetail.tsx`
- Add route in `src/App.tsx`
- Link to it from `FarmerDetail` lands list and from `LandRelations` rows ("View land")

No DB changes — reuses existing `land_relations`, `lands`, `lands_with_location`, `irrigation_charges`.

---

## 2. CSV Templates (Payments, Irrigation, Cashbook)

Add a "Download template" button per module on `/import` that downloads a CSV with the exact accepted headers + 1 example row + a `# instructions` comment row.

Templates:
- **payments.csv** — `account_number, amount, kind, method, paid_on, reference_id, note, idempotency_key`
- **irrigation_charges.csv** — `account_number, dag_no, season_name, basis, base_charge, canal_charge, maintenance_charge, other_charge, quantity, entry_date, note`
- **cashbook_receipts.csv** — `receipt_date, head, payer, amount, method, note`
- **cashbook_expenses.csv** — `expense_date, head, payee, amount, method, note`

Implementation: small helper `src/lib/importTemplates.ts` returning CSV strings, triggered via `Blob` download in `DataImport.tsx`.

---

## 3. Import Preview Step (Dry-run)

In `DataImport.tsx`, add a 2-step flow:
1. **Parse + Resolve** — read file, resolve account_numbers → farmer_ids, lands, etc., **without writing**. Classify each row as `insert | update | skip(error)` (esp. for Land Relations upsert mode and idempotent payments).
2. **Preview table** — show row #, action, resolved IDs, key fields, and any validation errors. User clicks "Confirm import" to actually write.

Refactor `DataImport.tsx`:
- Extract the per-row resolver into `buildPlan(rows, module, mode)` returning `PlanRow[]`
- Extract the writer into `applyPlan(planRows)`
- UI: "Preview" → table → "Confirm" / "Cancel"

---

## 4. Import Audit Log

New table `public.import_audit_logs`:
- `id`, `user_id`, `office_id`, `module` (text), `mode` (text: insert/upsert)
- `rows_processed`, `rows_inserted`, `rows_updated`, `rows_failed`
- `error_report_url` (text, nullable — for now stores a data: URL or a stored object key; v1 keeps the CSV client-side and stores `null`, recording counts only)
- `summary` (jsonb: per-row IDs, ledger entry IDs)
- `created_at`

RLS:
- INSERT: any authenticated user for own `user_id`
- SELECT: super_admin OR admin within same office

UI: new tab on `/import` "Recent imports" listing the last 50 with download-error and re-open-summary actions.

---

## 5. Ledger Posting Verification

After `applyPlan` runs, for each inserted **payment / irrigation_charge / cashbook receipt+expense**, immediately query `ledger_entries WHERE reference_id IN (...inserted ids...)` and:
- Display a results table: row → record id → ledger entry IDs (debit/credit summary) → ✅/⚠️
- Flag rows with no ledger entries as warnings (trigger may not have fired)
- Persist these IDs into the `summary` jsonb of the audit log row

This relies on the existing DB triggers (no trigger changes). Purely a verification surface.

Also: extend `src/pages/__tests__/PaymentLedgerStatement.flow.test.tsx` with one extra assertion that an imported payment produces ledger entries with matching `reference_id`.

---

## Technical notes

- One migration only (audit log table + RLS).
- All other changes are frontend (TS/React) under `src/pages/DataImport.tsx`, `src/pages/LandDetail.tsx`, `src/lib/importTemplates.ts`, `src/App.tsx`.
- Non-breaking: no changes to ledger logic, account_number logic, or existing RLS on financial tables.
- i18n keys added to `src/i18n/translations.ts` as needed (English + Bangla).

## Out of scope for this round

- Storing error reports as files in Supabase Storage (kept client-side download for now).
- Bulk re-run of failed rows from the audit log (can be added later).

Confirm and I'll implement in this order: migration → templates + LandDetail (parallel) → preview/verification refactor → audit log UI.
