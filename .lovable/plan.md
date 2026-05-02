## Plan: 5 features

### 1. PDF receipts for savings deposits & loan payments
- Reuse existing `exportPaymentReceiptPDF` helper (already used in `Savings.tsx`).
- **Savings.tsx**: Print button already exists for approved rows — verify it works for deposits (already approved by default) and add Bangla labels alongside English in the receipt.
- **Loans.tsx (Loan payments table)**: Add a "Print receipt" button per approved loan_payment row that calls `exportPaymentReceiptPDF` with farmer + payment data.
- Update `paymentReceiptPdf.ts` template so each label shows both Bangla and English (e.g. "তারিখ / Date", "পরিমাণ / Amount").

### 2. Global ledger search/filter
- **Ledger.tsx**: Add filter bar with: Office dropdown (super admin only), Farmer search (by code/name), Payment type (loan/savings/irrigation/expense/journal), Date range (from/to).
- Filters apply to the SELECT query on `ledger_entries` joined with farmer info via `reference_id` lookup.

### 3. Approve/reject flows with comments + audit
- **Approvals.tsx**: Add a comment textarea in approve/reject dialogs. Save comment to `note` field (savings) or new `approval_note` column on `loan_payments`.
- Audit logs already auto-fire via `audit_trigger` (verified in db functions). Comment becomes part of `new_values` diff.
- Role gate: `is_committee_or_super` already enforced via RLS; UI hides buttons for non-committee.
- Add **loan status change** UI in `Loans.tsx` (approve/reject pending loans) — committee only.

### 4. Office-scoped dashboard widgets
- **Dashboard.tsx**: Add cards filtered by `current_user_office()` (RLS does this automatically for non-super-admin).
- Widgets: Total Farmers (office), Active Loans + outstanding, Savings balance, This-month collections (loan + savings + irrigation), Pending approvals count.
- For super admin: show "All offices" with optional office filter dropdown.

### 5. Irrigation due report (PDF + Excel)
- New page `src/pages/reports/IrrigationDueReport.tsx`.
- Query `irrigation_charges` grouped by farmer + land + season, summing `due_amount`.
- Filters: office (super only), season, farmer search, only-with-due toggle.
- Export buttons: PDF (jsPDF + autotable) and Excel (xlsx) — both already used in `src/lib/exports.ts`.
- Add route `/reports/irrigation-due` and sidebar link under Reports.

### Schema change
Add `approval_note text` column to `loan_payments` and `savings_transactions` (savings already has `note` — reuse it; only loan_payments needs the column).

### Files
- **New**: `src/pages/reports/IrrigationDueReport.tsx`
- **Modified**: `src/pages/Loans.tsx`, `src/pages/Savings.tsx`, `src/pages/Approvals.tsx`, `src/pages/Ledger.tsx`, `src/pages/Dashboard.tsx`, `src/lib/paymentReceiptPdf.ts`, `src/lib/exports.ts`, `src/App.tsx`, `src/components/layout/AppSidebar.tsx`
- **Migration**: add `approval_note` column to `loan_payments`

Approve to proceed.