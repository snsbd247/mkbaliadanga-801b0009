
# Full i18n Cleanup & Language Persistence

## Goal

Make every menu, page, tab, filter, empty state, toast, PDF/Excel export, and dialog respect the EN/BN toggle. No hardcoded Bengali or English strings should remain in the UI layer. Logged-in user's language preference must be remembered across sessions.

## Scope (in order of execution)

### 1. Audit — find every hardcoded string
Run a project-wide scan to catalog hardcoded text:
- Bengali characters (`/[\u0980-\u09FF]/`) anywhere in `src/**/*.{ts,tsx}`
- Hardcoded English JSX strings (titles, button labels, table headers, toast messages, placeholders)
- `// i18n-ignore-file` markers — review whether they're justified, remove if not
- `toast.error("...")` / `toast.success("...")` / `confirm("...")` calls with literal strings

Output: `docs/i18n-cleanup-report.md` listing each file, line, and the string to extract.

### 2. Translation registry expansion
Add all newly-extracted keys to `src/i18n/translations.ts` (both `en` and `bn` blocks). Group by module:
- `dashboard.*`, `farmers.*`, `loans.*`, `savings.*`, `irrigation.*`, `settings.*`
- `reports.*` (already partially done — finish the remaining report pages)
- `common.*` for shared labels (Save, Cancel, Delete, Confirm, etc.)
- `toast.*` for success/error messages
- `export.*` for PDF/Excel headers

### 3. Page-by-page conversion
Replace hardcoded strings with `t("key")` calls, file by file. Priority order:

**Reports (finish what's started):**
- `CollectionReport`, `ExpensesReport`, `FarmerRejectionsReport`, `InvoiceReport`, `IrrigationDueReport`, `PromiseDueReport`, `ReceiptKindReport`, `SavingsLoanReport` — tabs, filters, empty states, table headers, export buttons.

**Dashboard:**
- `Dashboard.tsx`, `FarmerDashboard.tsx`, dashboard cards (`SmsProviderStatusCard`, etc.)

**Farmer module:**
- `Farmers.tsx`, `FarmerDetail.tsx`, `FarmerCard.tsx`, `FarmerStatement.tsx`, `FarmerProfileReport.tsx`, `FarmersImport.tsx`, `BulkCards.tsx`, `VoterList.tsx`, `VoterAudit.tsx`, `VoterHistory.tsx`, dialogs in `components/farmers/`

**Loans:**
- `Loans.tsx`, `LoanDetail.tsx`, `LoanPlans.tsx`, `LoanReceiptSettings.tsx`, `BulkLoanExport.tsx`

**Savings:**
- `Savings.tsx`, `SavingsStatement.tsx`, `ShareCollection.tsx`, `ShareCapitalReconciliation.tsx`

**Irrigation:**
- `IrrigationInvoices.tsx`, `IrrigationRates.tsx`, `IrrigationReports.tsx`, `irrigation/IrrigationReportCharts.tsx`, `components/farmers/IrrigationInvoicesTab.tsx`, `components/payments/IrrigationPaymentPanel.tsx`

**Settings & Admin:**
- `Settings.tsx`, `SmsSettings.tsx`, `Backup.tsx`, `Offices.tsx`, `Seasons.tsx`, `Users.tsx`, `Profile.tsx`, `ReceiptTemplate.tsx`, `CardDesigner.tsx`, all `pages/admin/*`

**Shared components & toasts:**
- `components/layout/*`, `components/auth/*`, `components/receipts/*`, `components/exports/ExportDialog.tsx`

### 4. Persist user language preference
Currently `LanguageProvider` uses `localStorage` only. Extend it:

- Add `language` column to `profiles` table (`text default 'bn' check (language in ('en','bn'))`).
- On login, `LanguageProvider` reads the user's `profiles.language` and applies it (overrides localStorage).
- When user toggles language, write to `profiles.language` (debounced upsert) for the logged-in user.
- Anonymous users (auth screen, farmer portal login) keep using `localStorage`.
- On logout, fall back to `localStorage` / browser default.

### 5. PDF & Excel exports
Audit every export function in `src/lib/`:
- `bnReceipts.ts`, `cardPdf.ts`, `paymentReceiptPdf.ts`, `irrigationInvoicePdf.ts`, `csvExport.ts`, `landExport.ts`, `landRelationsExport.ts`, `exports.ts`, `irrigationExports.ts`

For each: accept current `lang` (from `LanguageProvider`) and:
- Localize PDF titles, column headers, footer.
- Format numbers with `bnNumber` for BN, regular for EN.
- Format dates via `format.ts` helpers (`fmtDate`, `fmtMoney`) using locale-aware variants.
- For CSV/Excel, headers in chosen language; numeric values stay machine-readable (no Bengali digits in CSV — keep ASCII for data integrity, only headers translated).

Update each call site to pass the active language.

### 6. QA — manual and automated
- Run `scripts/i18n-scan.mjs` to confirm no new hardcoded strings remain.
- Update `e2e/i18n-smoke.spec.ts` and `e2e/pdf-localization.spec.ts` to cover the newly-localized pages.
- Manually toggle EN ⇄ BN on every menu route via the browser tool; screenshot each report and dashboard page to confirm:
  - Tab labels translated
  - Filter labels & placeholders translated
  - Table headers translated
  - Empty-state messages translated
  - Toast messages translated
  - Date/money formatted per locale
- Open one PDF and one CSV export per module in each language and visually verify.

### 7. Execution batches (delivery plan)
This work is too large for a single message. I propose splitting into 6 commits, each independently mergeable:

| Batch | Scope | Approx files |
|-------|-------|--------------|
| 1 | Audit script + translation key additions + persistence migration | ~5 |
| 2 | Reports module finish | ~10 |
| 3 | Dashboard + Farmer module | ~15 |
| 4 | Loans + Savings + Irrigation | ~15 |
| 5 | Settings + Admin + shared components | ~20 |
| 6 | Exports (PDF/CSV) + QA tests + screenshots | ~10 |

After each batch I'll run the i18n scan and show you the remaining count so progress is measurable.

## Open questions

1. **Language column default** — should new users default to `bn` (current app default) or detect from browser?
2. **CSV exports** — keep numeric values in ASCII digits even in BN mode (recommended for re-importability), or output Bengali digits in the visible cells?
3. **Should I start now with Batch 1 (audit + persistence + translation keys)** so you can review the foundation before I touch the page files? Or proceed straight through all 6 batches?

