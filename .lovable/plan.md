## Phase C — Reports & Analytics ✅ COMPLETE

- **C1** Dashboard KPI widgets + 30-day sparkline — shipped in `src/pages/Dashboard.tsx`
- **C2** Member combined statement PDF — `exportFarmerCombinedStatementPDF` in `src/lib/exports.ts`, button in `FarmerStatement.tsx`
- **C3** Monthly Receipt Register — `src/pages/reports/MonthlyReceiptRegister.tsx`, route `/reports/receipt-register`
- **C4** Officer Summary — `src/pages/reports/OfficerSummaryReport.tsx`, route `/reports/officer-summary`

## Phase D — Asset lifecycle ✅ COMPLETE (core)

- 13 DB tables, 15 UI pages (registry, stock, movements, installations, maintenance, disposal, depreciation, QR, etc.)
- Asset transfer **approval workflow** (pending → approved/rejected, audit logged) — `assetStock.ts`, `AssetMovements.tsx`

## Phase E — Candidates (next)

### E1 — Asset alerts (SMS automation)
- Low-stock SMS when `asset_stocks.quantity` drops below `assets.min_stock_level`
- Warranty-expiry reminder N days before `assets.warranty_expires_on`
- Scheduled edge function (cron) + SMS template integration

### E2 — Recurring maintenance scheduler
- New table `asset_maintenance_schedules` (asset_id, frequency, next_due_at)
- Daily edge function to convert due schedules into `asset_maintenance_logs` reminders + SMS

### E3 — Asset depreciation auto-post
- Monthly job posts depreciation journal entries via `AccountingService`
- Already have `asset_depreciation_schedule` table — wire to ledger

### E4 — GreenWeb SMS provider admin UI deepening
- Provider failover priority, per-template provider override, delivery report ingestion

### Order
E1 → E2 → E3 → E4 (each ships in its own turn on "next"). User may also pick any out of order.
