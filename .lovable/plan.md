# Irrigation Payment Flow Refactor — Plan

This is a large, multi-area change. Proposing a phased rollout so nothing existing breaks (receipts, QR verify, ledger integrity, statements, reports, RLS).

## Scope summary

Separate **Current Invoice Collection** from **Previous Season Due Collection** in the irrigation payment workflow, add **Promise Date** bypass, **Delay Fee override** with audit, **split ledger heads**, **new report**, and updated **receipt + SMS** — without breaking existing modules.

---

## Phase 1 — Database foundations (migration)

### 1.1 New table: `irrigation_due_promises`
```
id, office_id, farmer_id, payment_id (nullable until linked),
previous_due_amount numeric, promise_date date, remarks text,
approved_by uuid, status text default 'pending'
  -- pending | fulfilled | overdue | broken
fulfilled_at timestamptz, created_at, updated_at
```
RLS: office-scoped read; admin/committee insert; super_admin manage.
Trigger: nightly/at-read derivation of `overdue` (computed in queries; no cron needed initially).

### 1.2 Extend `irrigation_invoice_payments`
Add columns (nullable, backward compatible):
- `current_invoice_collected numeric default 0`
- `previous_due_collected numeric default 0`
- `delay_fee_override_reason text`
- `delay_fee_original numeric` (snapshot when overridden)

Existing `collected_amount` continues to mean "total received" (sum). Old rows untouched.

### 1.3 New table: `irrigation_delay_fee_audit`
```
id, invoice_id, payment_id, original_amount, modified_amount,
reason text, changed_by, office_id, created_at
```
RLS: office read, admin insert.

### 1.4 Chart of accounts
Ensure system accounts exist (insert if missing, idempotent):
- `IRR-INCOME` Irrigation Income
- `IRR-PREV-DUE` Previous Due Collection
- `IRR-DELAY` Delay Fee Income
- `IRR-MAINT` Maintenance Income
- `IRR-CANAL` Canal/Nala Income

(Existing ledger postings remain unchanged for old payments.)

---

## Phase 2 — Payments page UI (`src/pages/Payments.tsx` + `IrrigationInvoicesTab` flow)

New layout when `kind = irrigation`:

```
┌─ Step 1: Farmer search (existing)
├─ Step 2: Select current invoice(s)  → from irrigation_invoices where due_amount>0 & current season
├─ Step 3 (auto): Current Invoice Panel
│    Invoice No | Season | Irrigation | Delay Fee [editable] | Maintenance | Canal | Total Payable
│    Input: "বর্তমান বকেয়া থেকে গ্রহণ" (current_invoice_collected)
├─ Step 4 (auto): Previous Due Panel  (only if previous unpaid invoices found)
│    ⚠ banner + expandable season/invoice/due table
│    Input: "পূর্বের বকেয়া থেকে সংগৃহীত" (previous_due_collected)
├─ Step 5: Validation
│    if previousDueRemaining > 0 AND special_permission=false → block submit
│    if special_permission=true → require promise_date + remarks
└─ Step 6: Submit → atomic insert (payment + iip + promise + audit)
```

Receipt total = current + previous.

## Phase 3 — Payment submit logic

Refactor `submitIrrigationPayment` (or equivalent) to:
1. Validate (zod): `current_invoice_collected ≥ 0`, `previous_due_collected ≥ 0`, sum > 0, no fully-paid/cancelled invoice selected.
2. Insert one `payments` row (`amount = current + previous`, `kind=irrigation`).
3. Insert one `irrigation_invoice_payments` row per selected invoice with split fields.
4. If delay fee changed from snapshot → insert `irrigation_delay_fee_audit`.
5. If `special_permission=true` → insert `irrigation_due_promises` row, link to payment.
6. Post journal entries split by ledger head (5 lines instead of 1).
7. Queue SMS with new template.
8. Update existing invoice `paid_amount/due_amount` (current invoices only).

All in a single supabase RPC for atomicity (`fn_post_irrigation_payment`).

## Phase 4 — Receipt (`bnReceipts.ts` / `paymentReceiptPdf.ts`)

Add irrigation receipt variant with two sections:
- **বর্তমান বকেয়া** — line items per selected invoice
- **পূর্বের বকেয়া থেকে সংগৃহীত** — single line
- **মোট গ্রহণ** — grand total

Keep old receipts working: branch only when `previous_due_collected > 0` or new flag set; otherwise render legacy layout.

## Phase 5 — SMS template

Update `send-sms` payload builder for irrigation:
```
আপনার সেচ বিলের ৳{current} এবং পূর্বের বকেয়া ৳{prev} গ্রহণ করা হয়েছে।
অবশিষ্ট বকেয়া ৳{remaining}{promise_line}
```

## Phase 6 — Reports

- **Update**: `IrrigationDueReport`, `CollectionReport`, `ReceiptKindReport`, `InvoiceReport` — add columns: Current Collection / Previous Due Collection / Delay Fee / Maintenance / Canal.
- **New**: `src/pages/reports/PromiseDueReport.tsx` — list `irrigation_due_promises` with farmer, due, promise_date, status; filters: office, status (pending/fulfilled/overdue/broken), date range; export CSV/PDF.
- **New (admin)**: `src/pages/admin/IrrigationDueMismatch.tsx` — list farmers where `sum(irrigation_invoices.due_amount)` differs from stat-card aggregation (referenced in earlier message).

## Phase 7 — Demo importer fix (also from earlier message)

In `supabase/functions/demo-reset` (or DataImport flow): add **Share Balance** import. Audit other modules and fix gaps:
- share_balance / share_capital
- savings opening balance
- (verify) loan EMI schedule, irrigation invoices, voter flags

## Phase 8 — Tests

- Unit: split-amount calculation, delay fee override, promise validation.
- Integration: payment RPC posts split journal correctly.
- E2E (Playwright): full flow — current+previous, blocked submit, promise bypass, override audit.

---

## Technical notes

- **Backward compat**: every new column nullable; old code paths read `collected_amount` = sum.
- **Atomicity**: server-side RPC prevents partial writes.
- **RLS**: office_id on every new table; mirror existing irrigation policies.
- **Audit**: delay_fee + promise + payment all logged.
- **i18n**: all new strings via `t()`; Bengali-first labels.

---

## Rollout order (recommended)

1. Approve plan.
2. Run Phase 1 migration.
3. Implement Phase 2–5 (Payments UI + RPC + receipt + SMS).
4. Implement Phase 6 reports.
5. Phase 7 importer fix.
6. Phase 8 tests + verify build.

Given the size, I suggest we do this in **2–3 separate messages** rather than one giant change, so each phase can be reviewed in the preview before moving to the next. **Shall I start with Phase 1 (migration) + Phase 2–3 (Payments UI + RPC) in this round?**
