# Irrigation Module Stabilization Plan

This is a large, multi-area cleanup. To stay safe and avoid breaking existing flows (ledger, receipts, payments, QR, accounting), I'll deliver it in **phased PRs** rather than one massive change. Each phase is independently shippable and testable.

## Phase 1 — Snapshot Safety + Rate Fallback (highest risk, ship first)

**DB migration**
- Add `irrigation_invoices.is_manual_rate boolean default false`, `manual_rate_reason text`, `recalculated_at timestamptz`, `recalculated_by uuid`.
- Add trigger `trg_protect_invoice_snapshot` on `irrigation_invoices` UPDATE: blocks changes to `calculation_snapshot`, `season_rate`, `land_type_id`, `land_type_name` unless the SQL `set local app.allow_snapshot_rewrite = 'on'` flag is set (used only by the recalc RPC).
- Add RPC `recalculate_irrigation_invoice(invoice_id, reason)` — admin-only, archives old snapshot into `irrigation_invoice_audit`, writes new snapshot, sets `recalculated_*`.

**Frontend (`src/pages/IrrigationInvoices.tsx`)**
- Edit dialog: snapshot fields (rate, land type, snapshot JSON) become **read-only** with a "স্ন্যাপশট সুরক্ষিত" badge.
- New "পুনঃগণনা" button (admin only) → opens reason dialog → calls RPC.
- Bulk + manual generation: before insert, run rate check. If missing, open `RateMissingDialog` with three actions: *Set manual rate*, *Go to rate config*, *Cancel*. Manual rate path stores `is_manual_rate=true` + reason.

## Phase 2 — Sidebar Restructure + Rate Audit Log

**DB migration**
```
irrigation_rate_audit_logs(id, office_id, irrigation_season_id, land_type_id,
  old_rate numeric, new_rate numeric, change_reason text,
  changed_by uuid, changed_at timestamptz default now(), ip text)
```
- Trigger on `irrigation_season_rates` INSERT/UPDATE/DELETE → writes audit row.
- RLS: admin/super read; insert via trigger only.

**New page** `src/pages/admin/RateAuditLog.tsx` at `/admin/rate-audit` with filters (date, office, season, land type), export to CSV, detail modal.

**Sidebar (`src/components/layout/AppSidebar.tsx`)** — split current Operations group:
```
Operations:           সেচ ইনভয়েস, পেমেন্ট, রসিদসমূহ
Irrigation Reports:   সেচ রিপোর্ট, ওভারডিউ, বিলম্ব ফি, বর্গা, সিজন
Irrigation Settings:  সিজন টাইপ, জমির ধরন, সিজন রেট, সেচ চার্জ সেটিংস, রেট পরিবর্তন ইতিহাস
```
Move existing irrigation entries; keep permission gating; add icons + dividers (already supported by current Collapsible groups).

## Phase 3 — i18n Cleanup + Export Enrichment

**i18n** — add canonical keys to `src/i18n/translations.ts`:
`irrigationInvoice, irrigationCollection, seasonRate, landType, delayFee, canalCharge, maintenanceCharge, payableAmount, dueAmount, paidAmount, manualRate, snapshotProtected, recalculate, rateMissingTitle, rateMissingBody`.
Replace hardcoded Bangla/English mixes in: `IrrigationInvoices.tsx`, `Seasons.tsx`, `admin/Lookups.tsx`, `IrrigationRates.tsx`, `reports/IrrigationDueReport.tsx`, `reports/InvoiceReport.tsx`, related toast/validation strings.

**Exports** (`src/lib/exports.ts` + report pages) — add columns:
`season_rate, land_type_name, is_manual_rate, manual_rate_reason, generated_by_name, payment_status, calculation_snapshot` (JSON column for Excel; flattened summary for PDF).

## Phase 4 — Demo Refresh + Tests

- Update `supabase/functions/demo-reset/index.ts` to seed: 3 season types, 5 land types, 2 seasons with full rate matrix, sample invoices (paid/partial/overdue/borga/manual-rate), rate audit history, SMS logs. Preserve admin user.
- Vitest additions:
  - `irrigationInvoice.snapshot.test.ts` — trigger blocks snapshot mutation.
  - `irrigationInvoice.rateMissing.test.ts` — fallback dialog flow.
  - `rateAuditLog.test.ts` — trigger writes audit row on rate change.
  - `exports.irrigationColumns.test.ts` — new fields present.
  - `AppSidebar.irrigationGroups.test.tsx` — three groups render with permissions.

## Out of Scope / Non-Goals
- No changes to ledger, payments, receipts, QR, or accounting code paths.
- No schema changes to `irrigation_charge_settings` or `lands`.
- Backward compatible: old invoices without `is_manual_rate` default to `false`.

## Suggested Execution Order
I recommend approving and shipping **Phase 1 first** (highest value + risk), validating in preview, then proceeding sequentially. Reply with "next phase 1" (or which phase to start) and I'll implement.
