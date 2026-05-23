## Phase C — Reports & Analytics ✅ COMPLETE

- C1 Dashboard KPIs + sparkline, C2 Combined statement PDF, C3 Monthly Receipt Register, C4 Officer Summary

## Phase D — Asset lifecycle ✅ COMPLETE (core)

- 13 DB tables, 15 UI pages, transfer approval workflow

## Phase E — Automation & SMS depth ✅ COMPLETE

- **E1** Asset SMS alerts (low-stock + warranty) — `asset-alerts-scan` edge fn, `asset_alerts` table, `/assets/alerts` page
- **E2** Recurring maintenance scheduler — `asset_maintenance_schedules` table, "Mark done & advance" UI, alerts integration
- **E3** Depreciation auto-post — `run_monthly_depreciation_batch` RPC, `asset-depreciation-run` edge fn, batch button in UI
- **E4** GreenWeb SMS deepening:
  - `sms_provider_secrets.priority` for failover order (UI in SmsSettings)
  - `sms_templates.preferred_provider` per-template override (UI in SmsTemplates)
  - `sms-delivery-report` edge fn for provider DLR ingestion → `sms_logs.delivered_at` / `dlr_payload`
  - `send-sms` rewritten to try providers in priority order, template override first

## Phase F — Candidates (next)

### F1 — Operational dashboards
- Per-office SMS health (sent / delivered / failed last 24h, provider mix)
- Asset alerts heatmap + maintenance burn-down
- Depreciation posting status calendar (which months are posted per asset)

### F2 — Member self-service portal expansion
- Maintenance / depreciation visibility for owned irrigation equipment
- Push notifications via SMS for upcoming dues + delivery confirmations

### F3 — Bulk operations
- Bulk asset import/export (CSV) with validation
- Bulk SMS announcements with template + variable preview
- Bulk depreciation backfill for historical months

### F4 — Period-close & audit
- Monthly period-close workflow with snapshot
- Cross-office trial balance + variance report
- Immutable journal locking once a period is closed

### Order
F1 → F2 → F3 → F4 (one per turn). User can also reorder.

## Batch P-C1 — Original Phase C tail ✅ COMPLETE

- Multi-rate per season: `seasonRates.ts` confirmed (office-override path); added test for office-scoped rate precedence.
- কাঠা conversion: org standard **1 কাঠা = 0.15 বিঘা (≈ 4.95 শতক)** added to `irrigationCalc.ts` with helpers `shatakToKatha`, `kathaToShatak`, `bighaToKatha`, `kathaToBigha`, and new `formatLandSize(..., "with_katha")` variant. Tests added.
- A5 irrigation receipt: added `"a5"` to `PaperFormat`, two A5 presets (single & tight) in `PRINTER_PRESETS`, A5 option in IrrigationInvoices paper-size selector, default cut-line 105mm.

### Next remaining original-plan batches
- ~~P-C2 historical land tracking~~ ✅ `land_history` table + `/land-history` page (Add/Filter, admin-only delete)
- ~~P-D1 cashbook split + temporary loan report~~ ✅ `loans.is_temporary` flag + `/loans/temporary` report page with PDF/Excel
- ~~P-D2 bank accounts + voucher upload~~ ✅ `bank_accounts`, `bank_transactions` (deposit/withdraw/charge/interest + bank-to-bank transfer via `transfer_group`), `/bank-accounts` page with running balance per account; `vouchers` table with auto `voucher_no` via `next_voucher_no()` RPC, private `vouchers` storage bucket, `/vouchers` page with file upload + signed-URL download.
- P-D3 audit reports (PDF/Excel/Word)
- P-E1 land owner separation finishing + cultivation history + change remarks
- P-E2 better payment UI + receipt void
- P-E3 online public payment portal
