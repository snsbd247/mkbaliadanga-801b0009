# Loan Penalty Engine v2 — Expansion Plan

This builds on the Phase 2 work already shipped (`loan_delay_fee_settings`, `loanDelayFee.ts`, `LoanDelaySettings.tsx`, strict-validation in `Payments.tsx`, `LoanOverdueReport`, `InstallmentCollectionReport`, `LoanPenaltyReport`, demo seeding). It expands the engine to **daily / combined penalties**, **snapshots**, **strict-mode toggle**, **smart import**, and **status auto-sync**.

I'll ship in **6 phases**. Each phase is self-contained and leaves the system green.

---

## Phase A — Schema additions (additive only, zero risk)

Migration:
- `loan_delay_fee_settings`: add `daily_penalty NUMERIC DEFAULT 0`, `max_penalty NUMERIC`, `enforcement_mode TEXT DEFAULT 'block'` (`block|warn|allow`), rename concept of `mode` → keep existing `flat|percent` and add `daily|combined` values.
- `loan_installments`: add `penalty_amount NUMERIC DEFAULT 0`, `overdue_days INTEGER DEFAULT 0`, `penalty_rule_snapshot JSONB`, `strict_validation_override BOOLEAN DEFAULT FALSE`. (`installment_status` already exists as `status` — keep.)
- `loan_payments`: add `penalty_collected NUMERIC DEFAULT 0`, `override_reason TEXT`, `override_by UUID`.
- Indexes: `loan_installments(loan_id, due_date, status)`, `loan_payments(payment_date)`, `loan_payments(loan_id)`.
- Trigger `loan_payment_after_insert`: recompute `loans.status` (`completed` when all installments paid, `overdue` when any past-due unpaid, else current value).

## Phase B — Engine v2 (`src/lib/loanDelayFee.ts`)

Extend pure functions:
- `mode: "flat" | "percent" | "daily" | "combined"`.
- New formulas with `max_penalty` cap and `grace_days`.
- `computePenaltyBreakdown()` returns `{ percentPart, dailyPart, fixedPart, capped, overdueDays, total }`.
- `buildPenaltySnapshot()` returns the JSON stored on the installment at payment-time.
- Backward-compatible: existing `flat|percent` callers unchanged.

## Phase C — Settings UI + Strict Mode

Update `src/pages/admin/LoanDelaySettings.tsx`:
- Add `daily_penalty`, `max_penalty`, `enforcement_mode` (block/warn/allow).
- Live preview card: enter installment + days late → see calculated breakdown.
- Bangla helper text for each field.

## Phase D — Payment flow upgrade

`src/pages/Payments.tsx` (loan branch) + `LoanDetail.tsx`:
- Show breakdown card: Installment / Penalty / Total payable / Previous due / Remaining.
- Honor `enforcement_mode`:
  - `block` → reject under-payment with the Bangla toast.
  - `warn` → confirm dialog, proceed.
  - `allow` → require **override reason**, write `override_reason` + `override_by`, log to `system_audit_logs` and `loan_installment_delay_audit`.
- On insert: write `penalty_collected`, snapshot `penalty_rule_snapshot` to the installment row.
- After insert: recompute installment `status`, `paid_amount`, `penalty_amount`, `overdue_days`. (Trigger handles loan-level rollup.)

## Phase E — Smart Loan Import

`src/pages/DataImport.tsx` loan flow:
- Accept CSV columns: `Loan No, Installment No, Due Date, Amount, Status`.
- If installment rows missing for a loan → **auto-generate** schedule from loan plan + installment count + start date (Option 1) and surface the line in the report.
- Validations: duplicate installment, missing farmer, invalid loan mapping, invalid date/amount, office mismatch.
- Result modal: imported / skipped / failed / auto-generated counts + downloadable CSV error report (re-using `csvExport.ts`).
- Bangla validation message: **ইন্সটলমেন্ট ডাটা অনুপস্থিত। অটো-জেনারেট অথবা ইমপোর্ট সংশোধন করুন।**

## Phase F — Receipt + Tests

- `paymentReceiptPdf.ts` loan branch: add Installment No, Due Date, Paid Date, Installment Amount, Penalty, Total Received, Remaining (Bangla layout).
- Unit tests: daily/combined math, cap, grace, snapshot shape, status transitions.
- Integration test: override flow writes audit + payment columns.
- Playwright (`e2e/loan-reliability.spec.ts` extension): warn mode dialog, allow mode override prompt, import auto-generation banner.

---

## Compatibility guarantees

- All schema changes are **additive** (new columns/indexes/trigger). Existing `loans`, `loan_payments`, `loan_installments` columns untouched.
- Existing flat/percent settings continue to work — `daily=0`, `max_penalty=null`, `enforcement_mode='block'` defaults preserve current behavior.
- Receipts/SMS/ledger posting/RLS — unchanged interfaces.
- Demo-reset seed remains valid (new columns nullable / defaulted).

---

## How would you like to proceed?

Reply with one of:
- **"all phases"** — run A → F sequentially (one migration, then code).
- **"phase A"** / **"phase B"** … — run a single phase.
- **"skip import"** / **"skip receipt"** — drop a section.
