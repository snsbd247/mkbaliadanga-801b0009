## Scope

This is a very large change set. To stay non-breaking, I'll execute in **4 batches**, each independently shippable. After every batch, the app stays fully working.

Soft-delete strategy: add a `deleted_at timestamptz` column to user-facing tables and filter it in list queries. Existing `status` columns (farmers, payments, loans) keep their meaning — we do NOT repurpose them.

---

## Batch 1 — Farmer UI (quick wins, visible)

- **Farmer List**: add **Due Amount** column = `loan_due + irrigation_due − savings_balance` (clamped ≥0). Use existing views (`farmer_savings_balance`) + aggregate from `loans`/`irrigation_charges` in a single RPC `farmer_dues_summary(office_id)` returning `(farmer_id, loan_due, irr_due, savings_bal, net_due)`. Sortable column, color-coded.
- **Farmer List**: remove the "Print Card" action from the row menu.
- **Farmer Profile**: add **Print Membership Card** button in header (opens `/farmers/:id/card`).

## Batch 2 — Soft delete + Global CRUD polish

- Migration: add `deleted_at timestamptz` to `farmers`, `lands`, `loans`, `savings_transactions`, `irrigation_charges`, `payments`, `expenses`, `journal_entries`, `land_relations`, `voter_history`. Index `(deleted_at)` where helpful.
- Replace existing hard-delete actions on these tables with `UPDATE ... SET deleted_at = now()`.
- Default list queries get `.is('deleted_at', null)`. Add a "Show deleted" toggle for admins.
- Keep the existing **financial-link guard** (irrigation_charges, ledger_entries) — block soft-delete if linked, same UX.
- Restore action (admin only) → sets `deleted_at = null`.

## Batch 3 — Reports / PDF polish

- Shared `pdfHeaderFooter()` helper in `src/lib/exports.ts`: A4, company logo + name (BN/EN), page X of Y, generated date. Reused by all `export*Pdf` functions.
- Wire export-to-PDF buttons (where missing) on:
  - Loan report (per-farmer + summary)
  - Savings report
  - Irrigation report (already mostly there — unify header)
  - Ledger report
  - Audit logs (`/audit`)
- Bangla font already loaded for receipt PDFs — reuse same font path.

## Batch 4 — Accounting reports

Chart of Accounts + journal_entries already exist with auto-posting triggers. We add the **report pages** only (no accounting-engine changes):

- `/financial-reports/trial-balance` — sum debit/credit per account, period filter, export PDF/Excel.
- `/financial-reports/income-statement` — Income − Expense for period, with grouping by parent account.
- `/financial-reports/cash-bank` — running balance for accounts of type `asset` where code starts with `1010`/`1020`.
- `/financial-reports/expenses` — date-range expense breakdown (already partly in Cashbook, add report view + PDF).
- All read from `ledger_entries` (joined with `accounts`) — extension only, no writes.

A "Reports" landing page (`/financial-reports`) gets nav cards for each.

---

## Non-breaking guardrails

- No changes to existing posting triggers, `ledger_entries` schema, RLS policies on financial tables, payment flow, or QR.
- All new columns nullable with safe defaults.
- All new RPCs marked `STABLE` and `SECURITY INVOKER`.
- Each batch ends with a working app; previous functionality untouched.

---

## Order of execution

I'll do **Batch 1** now (visible to you within minutes), then move to Batch 2, 3, 4. After each batch I'll pause briefly for you to verify in the preview.
