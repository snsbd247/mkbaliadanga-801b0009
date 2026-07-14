# বর্গা ইনভয়েস Backfill ও Guard প্ল্যান

## ১. Backfill Migration (`is_borga=true` পুরনো ইনভয়েস)

প্রতিটি row-এর জন্য:

- **প্রকৃত area** = `land_relations.area_decimal` (active row, `deleted_at IS NULL`); না থাকলে `share_percentage/100 * lands.land_size`
- relation না পেলে **skip** (audit এ যাবে)
- **নতুন amounts:**
  - `ratio = new_area / old_billed_area` (old=০ হলে skip)
  - `irrigation_amount = round(old_irrigation_amount * ratio)`
  - `payable_amount = irrigation_amount + delay_fee + other_charge − discount_amount` (maintenance/canal বাদ — memory অনুযায়ী)
  - `due_amount = max(payable − paid, 0)`
  - `paid ≥ payable` → status `paid`, নাহলে `paid>0` → `partial`, নাহলে unchanged
- **`calculation_snapshot`** এ merge:
  ```json
  { "backfilled_at": "…", "backfill_source": "borga_area_fix_2026_07_14",
    "old": { "billed_area_shotok":…, "payable_amount":…, "irrigation_amount":…, "due_amount":… },
    "new": { "billed_area_shotok":…, "payable_amount":…, "irrigation_amount":…, "due_amount":… } }
  ```

### Safe Mode (default)
- **শুধু `paid_amount = 0`** ইনভয়েস আপডেট হবে
- `paid_amount > 0` কিন্তু `paid ≤ new_payable` → skip + audit (later phase)
- `paid > new_payable` → skip + audit (manual review)

### Audit Table
`irrigation_invoice_backfill_audit` (নতুন):
`invoice_id, invoice_no, farmer_id, old_area, new_area, old_payable, new_payable, paid_amount, action` (`updated` | `skipped_paid` | `skipped_overpaid` | `skipped_no_relation`), `reason, created_at`. RLS: admin-only read.

Payment/receipt rows **touch হবে না** — শুধু invoice এর area+amounts।

## ২. Invoice Edit/Regenerate Recalc

`src/pages/IrrigationInvoices.tsx` এ edit/regenerate পাথে ইতিমধ্যে `billedArea` বসছে (আগের ফিক্স)। এখন **guard যোগ:**
- Insert/update payload validate — `is_borga && billed_area_shotok > parcel_area_shotok` হলে throw
- edit-এ area পরিবর্তন হলে `irrigation_amount`/`payable_amount`/`due_amount` snapshot-এ old রেখে recalc হবে

## ৩. Billing Validation (নতুন invoice)

`src/lib/irrigationInvoice.ts` বা payload builder-এ:
- borga farmer এর জন্য `land_relations` না থাকলে error
- `billed_area_shotok` কখনো `parcel_area_shotok` অতিক্রম করবে না — assert

## ৪. PDF / Excel Export

`invoiceLandSize()` helper snapshot-first — আগের ফিক্সে হয়ে গেছে। ভেরিফাই করব:
- `src/lib/irrigationInvoicePdf.ts`
- `src/lib/irrigationReceiptData.ts` + `bnReceipts.ts`
- `PaidLandHistory`, `IrrigationDueReport`, `InvoiceReport`, `FarmerStatement`, `FarmerProfileReport`, `IrrigationPaymentCoverageAdmin` XLSX
- non-borga invoice untouched (fallback `lands.land_size` কাজ করছে)

## ৫. Automated Tests (vitest)

`src/lib/__tests__/irrigationBorgaBilling.test.ts`:
1. একজন বর্গাদার `area_decimal=0.333` → billed=0.333, payable=rate*0.333
2. দুইজন বর্গাদার 50/50 → দুইটি ইনভয়েস, প্রত্যেকটা অর্ধেক
3. `area_decimal` NULL হলে `share_percentage` fallback
4. non-borga → পুরো `land_size`
5. `billed > parcel` → validation throw

## ৬. Verification

- MASUD ALAM INV-20260707-0001: 0.665→0.333, payable 2519→~1261, paid=0 → **updated**
- ৯টি 50% invoice: area অর্ধেক, payable অর্ধেক
- INV-20260706182030-0001 (paid=450, new_payable~225): **skipped_overpaid** — audit-এ থাকবে
- INV-20260708-0011 (rel_pct=100): area unchanged, no-op
- পুরনো সেচ রশিদ reprint → নতুন area দেখাবে; payment amount অপরিবর্তিত

## ৭. Rollback

`calculation_snapshot.old` থেকে reverse migration সম্ভব — audit table-ই source of truth।

## Technical Notes

- Single migration file: audit table CREATE + GRANT + RLS + backfill DO block
- কোনো RPC/policy বদল নেই
- non-borga ইনভয়েস, অন্য মডিউল (loan/savings/cashbook/bank/shares) অপরিবর্তিত
- Migration approve করার পরে code (validation + tests) যোগ হবে
