# Fix Accounting Module Accuracy

## Problem (verified against live production data)
The accounting pages disagree with reality because the double-entry ledger only records irrigation payments. Expenses (৳94,307), and the society/savings side are missing, and two different amount columns are used across pages.

| Issue | Effect on pages |
|---|---|
| Expenses never posted to `ledger_entries` | Trial Balance, Chart of Accounts, Financial Reports show ৳0 expenses |
| `collected_amount` (৳21,714.22) vs `payments.amount` (৳21,716) | Financial Summary ≠ Ledger by ৳2 |
| No opening balances / no society income entries | Cash-in-hand shows negative (−৳46,713 / −৳25,880) |

## Approach
Make the ledger the complete double-entry record of every cash movement, and unify all pages on the same source figure.

### 1. Add missing Chart of Accounts accounts
Seed the accounts needed for full posting (backend `AccountsSeeder` + backfill):
- `5010` Irrigation Expense (expense)
- `5020` Society/Savings Expense (expense)
- `1030` Cash — society (or reuse `1010`)
- Opening-balance handling via existing `3000` Opening Balance Equity

### 2. Post expenses to the ledger (backend)
Extend `GenericTableController` auto-posting (same pattern already used for irrigation payments) so every approved `expenses` row writes a balanced journal:
- Dr Expense account (`5010`/`5020` by `stream`), Cr Cash.
- Idempotent guard on `reference_type='expense'` + `reference_id`.
Also wire the same for `office_incomes`, `savings_transactions`, `loan_payments`, and `loans` disbursement so the ledger is complete (each additive + idempotent).

### 3. Unify the amount source
Standardise irrigation income on `irrigation_invoice_payments.collected_amount` everywhere (Financial Summary already does). Update the irrigation payment posting to use `collected_amount`, and backfill/repair the 32 existing ledger rows so the ledger reads ৳21,714.22, eliminating the ৳2 gap.

### 4. Opening balances
Add an admin-entered opening cash/bank balance (Period Close / Chart of Accounts already have equity account `3000`). Cash-in-hand formula in `financialSummary.ts` and the ledger both start from opening balance so figures stop going spuriously negative.

### 5. Data backfill (one-time, live)
Run an idempotent repair against production MySQL to post journals for all existing expenses and correct the irrigation amounts, then re-verify each page.

### 6. Verify
Re-run the live login walkthrough and confirm on every page: Trial Balance shows real income AND expenses and stays balanced; Financial Summary, Finance Summary, Chart of Accounts, Ledger, Financial Reports, Monthly Reconciliation, Payment Reconciliation all agree.

## Technical notes / files
- `backend/app/Http/Controllers/GenericTableController.php` — expense/income/savings/loan auto-posting
- `backend/database/seeders/AccountsSeeder.php` — new accounts
- `backend/database/migrations/…` — backfill expense journals + fix irrigation amounts + opening balance
- `src/lib/irrigationPaymentPostings.ts` — use `collected_amount`
- `src/lib/financialSummary.ts` — opening balance in cash-in-hand
- `src/pages/Accounts.tsx`, `FinancialReports.tsx`, `FinanceSummary.tsx`, `Ledger.tsx`, `LedgerReconciliation.tsx` — confirm they read the completed ledger

## Open decision
For **opening balances** (step 4) I need the real starting cash/bank figures from you (or I can default them to 0, which keeps cash-in-hand negative but arithmetically correct). Everything else I can determine and fix from the data.
