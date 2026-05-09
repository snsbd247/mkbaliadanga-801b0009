# Loan Module Refactor Plan

This is a large, multi-area change. To keep it safe and reviewable (and to avoid breaking the live loan ledger / accounting / receipts / SMS), I'll deliver it in **5 phases**. Each phase is self-contained, ships passing tests, and leaves the existing flow working.

---

## Phase 1 — Full-page Loan Details + Installment View (UI only, zero schema risk)

**Route:** `/loans/:loanId`
- New page `src/pages/LoanDetail.tsx` (replaces modal; modal trigger in `FarmerDetail` becomes a `<Link>`).
- **Section 1 — Loan Summary**: loan no, farmer, plan, principal, interest, total payable, total paid, remaining due, status, start date, last installment date.
- **Section 2 — Installment counters**: total / paid / pending / overdue.
- **Section 3 — Installment table**: No, Due Date, Amount, Paid, Due, Payment Date, Delay Fee, Status (Pending / Paid / Partial / Overdue) with Bangla labels.
- Banner: **শেষ কিস্তির তারিখ** + **জরিমানা কার্যকর হবে** when `today > due_date && status != paid`.
- Print-friendly layout (reuse existing print CSS).
- Loan Timeline section (read existing `audit_logs` + `loan_payments` + `system_audit_logs`).

**No DB changes in this phase.** Overdue is computed client-side from existing columns.

---

## Phase 2 — Installment Enforcement + Delay Fee Engine

**Schema (migration):**
- `loan_delay_fee_settings` (office-scoped: `mode = flat|percent`, `value`, `grace_days`, `auto_apply`, `allow_partial_installment` default false).
- `loan_installment_delay_audit` (installment_id, original, modified, reason, changed_by, office_id).
- Indexes on `loan_installments(loan_id, due_date, status)` and `loan_payments(payment_date)`.

**Logic (`src/lib/loanDelayFee.ts`):**
- Pure function `computeInstallmentDelayFee(installment, settings, paymentDate)`.
- Allocation helper `allocateInstallmentPayment(amount, installment, delayFee, settings)`.

**Validation in `IrrigationPaymentPanel`-equivalent loan panel:**
- Block submit if `amount < (installmentAmount + delayFee)` AND `allow_partial_installment = false`.
- Toast: **নির্ধারিত কিস্তির চেয়ে কম টাকা গ্রহণ করা যাবে না।**
- Admin override field with reason → writes to delay-fee audit + `system_audit_logs`.

---

## Phase 3 — Payment Page Breakdown + Receipt Update

- Loan payment selector shows: current installment, overdue list, delay fee, previous due, **total payable** breakdown.
- Receipt PDF (`paymentReceiptPdf.ts` loan branch): adds Loan No, Installment No, Installment Due Date, Installment Amount, Delay Fee, Total Received, Remaining Loan Due. Bangla layout.

---

## Phase 4 — Reports + Timeline

- **Loan Overdue Report** (`/reports/loan-overdue`)
- **Installment Collection Report** (`/reports/installment-collection`)
- **Penalty Collection Report** (`/reports/loan-penalty`)
- Filters: office, loan plan, date range, status. Exports: CSV (existing `csvExport.ts`), PDF (existing pdf util), Excel via CSV-with-BOM.
- Sidebar entries gated by existing `permKey` system.

---

## Phase 5 — Demo Import + Reset Rebuild + Tests

- Extend `supabase/functions/demo-reset/index.ts` to seed:
  - loan master, installment schedule, installment statuses, payment history, penalties, overdue cases, receipts, ledger entries.
- FK & relationship validation (farmer_id / office_id / loan_plan_id).
- **Tests:**
  - Unit: delay-fee math, allocation, partial-payment blocker, overdue detector.
  - Integration: payment flow with override + audit write.
  - Playwright: navigate to `/loans/:id`, attempt underpayment → blocked, admin override succeeds, overdue badge visible.

---

## Compatibility guarantees

- No changes to existing `loans`, `loan_payments`, `loan_installments` columns — only **additive** (new tables + indexes).
- Existing modal stays functional during Phase 1 (replaced, not removed from DB).
- Ledger posting, SMS, receipt verification, RLS — untouched.

---

## How would you like to proceed?

Reply with one of:
- **"start phase 1"** — I'll begin with the full-page loan view (safest, no DB).
- **"all phases"** — I'll run phases 1 → 5 sequentially in this loop (long; multiple migrations will need approvals).
- **"phase X"** — jump to a specific phase.
