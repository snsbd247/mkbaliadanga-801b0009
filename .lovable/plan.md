# Irrigation Module Refactor — Invoice-Based Workflow Plan

This is a large, multi-phase refactor. To keep production safe and avoid breaking accounting, ledger, receipts, QR verification, and FIFO allocation, I'll deliver it in **6 sequential phases**. Each phase ends in a working, deployable state. You can approve the plan and I'll start with Phase 1, then check in before Phase 2.

---

## Phase 1 — Database Foundation (Safe Migration)

New tables (additive — old `irrigation_charges` stays untouched for backward compatibility):

- **`irrigation_invoices`** — one row per land per season
  - `invoice_no` (unique, auto-generated: `INV-{YYYYMMDD}-{seq}`)
  - `office_id, season_id, farmer_id` (assigned/billed farmer), `land_id`, `owner_farmer_id`
  - `irrigation_amount, maintenance_amount, canal_amount, delay_fee, other_charge`
  - `payable_amount, paid_amount, due_amount`
  - `due_date, invoice_status` (enum: `draft|generated|partial_paid|paid|overdue|cancelled`)
  - `generated_by, generated_at, cancelled_by, cancelled_at, cancel_reason, deleted_at`
  - Unique constraint: `(season_id, land_id) WHERE deleted_at IS NULL` → duplicate prevention
  - Indexes on `farmer_id`, `season_id`, `office_id`, `invoice_status`, `due_date`

- **`irrigation_charge_settings`** — per office config
  - `delay_fee_percent, maintenance_percent, canal_percent, grace_days, auto_apply_delay_fee`

- **`irrigation_invoice_payments`** — link table between invoices and `payments`
  - `invoice_id, payment_id, collected_amount, delay_fee_collected, maintenance_collected, canal_collected`

- **`irrigation_invoice_audit`** — every edit/override/cancel logged

- **Enum**: `invoice_status`
- **RLS**: office isolation + admin/super override (mirror existing `irrigation_charges` policies)
- **Trigger**: auto-update `invoice_status` and `due_amount` on payment insert/update; auto-mark `overdue` via daily cron or on-read computed field
- **Backfill**: optional script to convert existing `irrigation_charges` into invoices (keeps old data intact)

## Phase 2 — Borga (Sharecropper) Assignment Logic

Helper: `getBilledFarmerForLand(land_id, as_of_date)` →
- Checks `land_relations` for active `sharecropper_farmer_id`
- If active borga → bill sharecropper
- Else → bill `owner_farmer_id`

Used by: bulk generation, manual generation, regeneration, reports.

## Phase 3 — Irrigation Page Refactor (Invoice Generation Only)

- Remove all payment collection UI from `Irrigation.tsx`
- New tabs: **Generate Invoices** | **Invoice List** | **Settings**
- **Generate Invoices**: Select Season + Office → preview eligible lands → bulk generate (with skip-existing) OR manual single invoice
- **Invoice List**: filters (season/office/status/farmer/overdue), invoice preview modal, cancel workflow, regenerate, bulk SMS
- **Settings tab**: edit `irrigation_charge_settings`
- Invoice preview modal shows full breakdown with Bigha+Shatak

## Phase 4 — Payment Page Refactor (Single Source of Collection)

- Search farmer → load all unpaid + overdue invoices for that farmer
- Two sections: **Overdue (red)** | **Current Due**
- Per-invoice: editable Delay Fee / Maintenance / Canal / Other (with audit log on override)
- Auto-calc payable on edit; allow full or partial payment
- On submit:
  - Insert `payments` row
  - Insert `irrigation_invoice_payments` link rows
  - Update invoice `paid_amount`, `due_amount`, `invoice_status`
  - Post double-entry ledger (separate accounts: Irrigation Income / Maintenance / Canal / Delay Fee)
  - FIFO allocation preserved
- Reuses existing receipt + QR verification pipeline

## Phase 5 — Receipts, Reports, SMS

**Receipt** (`bnReceipts.ts`): adds Invoice No, Due Date, breakdown rows (Irrigation/Maintenance/Canal/Delay Fee), Owner vs Borga label, Bigha+Shatak land size. QR verification stays compatible (signs invoice_no + amount).

**Reports** (update + new):
- Update: Irrigation Due Report, Collection Report, Farmer Statement, Ledger Summary
- New: Overdue Invoice Report, Delay Fee Collection Report, Borga Irrigation Report, Season-wise Invoice Report
- All export PDF + Excel with Bigha+Shatak

**SMS** (via existing `send-sms` edge function):
- Invoice generated, Due reminder (T-3 days), Overdue reminder (daily cron), Payment confirmation
- Bulk SMS button on invoice list

## Phase 6 — Tests & Polish

- 30+ automated tests:
  - Unit: invoice calculation, delay fee formula, borga resolution, status transitions
  - Integration: bulk generation, payment posting → ledger, FIFO allocation, regeneration protection
  - E2E (Playwright): generate → view → pay → verify receipt → check ledger
- Mobile responsive invoice list/preview
- Season lock check on generation
- Soft delete + cancel workflow audit trail
- Recalculation utility (admin tool to recompute charges for a season)

---

## Technical Notes

- **No breaking changes**: `irrigation_charges` table and existing receipts continue to work. New `irrigation_invoices` runs alongside; reports gradually migrate to read from invoices.
- **Accounting safety**: New ledger account codes for Maintenance / Canal / Delay Fee will be created via migration with `is_system=true`. Existing Irrigation Income account stays.
- **FIFO preservation**: Payment allocation continues to use existing `farmerDues.ts` logic — invoice records become the new "due rows".
- **Performance**: Indexes on (farmer_id, status), (season_id, office_id, status), (due_date) for overdue queries.

---

## Delivery Checkpoints

1. Phase 1 (DB migration) — I'll send the migration for your approval first
2. After Phase 1 applied → Phase 2+3 (logic + Irrigation UI)
3. Phase 4 (Payment UI) — most sensitive, separate checkpoint
4. Phase 5 (Receipts/Reports/SMS)
5. Phase 6 (Tests)

**Estimated scope**: ~25-35 files touched/created across 5-6 working sessions. Old data preserved throughout.

Reply **"start phase 1"** to begin with the database migration, or tell me which phase to prioritize / skip.
