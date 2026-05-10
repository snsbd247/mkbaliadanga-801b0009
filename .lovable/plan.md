# Enterprise Asset Lifecycle Refactor — Phased Plan

This is a large multi-phase refactor. To keep the system stable and avoid breaking existing accounting/irrigation/payments/reports, we will ship in **6 small phases**, each independently safe and reviewable. After each phase you can say "next" to continue.

## Guiding rules (apply to every phase)

- **Backward compatible**: only additive DB changes (new tables / nullable columns / new RPCs). No renames, no destructive drops.
- **Transaction-safe accounting**: all journal posting via existing RPC pattern (like `post_asset_depreciation_journal`) — never inline SQL.
- **Bilingual**: every new label goes through `tx("EN","বাংলা")` / `src/i18n/translations.ts`.
- **Audit**: every mutation calls `logAssetAudit(...)`.
- **Soft delete only** for operational records (add `deleted_at`, filter in queries).
- **Permissions**: reuse `assets` ModuleKey + `RequirePerm`; no new perm modules.
- **No touching** irrigation / payments / receipts / SMS / existing reports / existing QR rotation.

---

## Phase 1 — Foundation: classification, statuses, soft-delete, registry rename

DB (single migration, additive):
- `assets.asset_type` enum-like text: `inventory | fixed_asset | consumable` (default `fixed_asset`, nullable→backfill).
- `assets.lifecycle_status` text expanded set: `purchased, in_stock, installed, in_use, maintenance, damaged, disposed, scrapped, lost` (keep existing `current_status` working; new column mirrors via trigger; old code keeps reading old col).
- `deleted_at timestamptz` on: `asset_movements`, `asset_installations`, `asset_maintenance_logs`, `asset_damage_reports`, `asset_disposals`.
- Indexes: `assets(asset_type)`, `asset_stocks(location_id, asset_id)`, `asset_movements(asset_id, movement_date desc)`.
- Guard trigger: prevent depreciation rows where `asset_type <> 'fixed_asset'`.

UI:
- Sidebar: rename label "Assets" → "Asset Registry / এসেট রেজিস্ট্রি" (route `/assets/items` unchanged).
- "Asset Bulk Op" → "Bulk Operations / বাল্ক কার্যক্রম".
- Add `asset_type` selector + badge to AssetItems list & create/edit dialog.
- Filter chips on registry: type, status, category, location.

Tests: extend `assetMath.test.ts` with status-flow + type-guard cases.

## Phase 2 — Dedicated Stock & Movement pages

New pages (operational, not popup-only):
- `src/pages/assets/AssetStock.tsx` — stock-in / stock-out / transfer / adjustment / reconcile, by location. Timeline view per asset.
- `src/pages/assets/AssetMovements.tsx` — full movement ledger (from/to/qty/user/date/remarks), filters + CSV export via `csvExport.ts`.
- Sidebar entries: "এসেট স্টক", "এসেট স্থানান্তর".
- Reuse existing `asset_stocks` & `asset_movements` tables (already populated by current dialogs); pages are read+write surfaces, no schema break.
- All mutations go through existing `applyStockDelta` helper + audit log.

## Phase 3 — Installations, Maintenance, Disposal full pages + details routes

- `src/pages/assets/AssetInstallations.tsx`, `AssetMaintenance.tsx`, `AssetDisposal.tsx` (list + filter + create + soft-delete).
- Detail routes:
  - `/assets/movements/:id`
  - `/assets/installations/:id`
  - `/assets/maintenance/:id`
  - `/assets/disposals/:id`
- Existing `AssetItemDetail` already shows full lifecycle tabs — keep, add deep-links to detail pages.
- Disposal accounting: extend RPC family with `post_asset_disposal_journal(asset_id, sale_amount, book_value)` → Dr Cash `1010`, Cr Asset cost / Accum Depreciation, Dr/Cr Gain or Loss on Disposal `4910/5910`. Idempotent (uses unique `source_ref`).
- Maintenance optional posting: settings flag `assets.post_maintenance_to_books` (default off).

## Phase 4 — Reports suite + bilingual exports

Add to `AssetReports.tsx` (or split into tabs):
- Asset Register, Stock, Movement, Installation, Maintenance, Damage, Disposal, Depreciation, Valuation, Audit.
- Filters: office, category, asset_type, status, location, date range.
- Exports: CSV (existing), Excel (xlsx skill), PDF (reuse `pdfFonts.ts`).
- All headers/labels bilingual.

## Phase 5 — Demo seed + tests + i18n sweep

- Extend `assetDemoSeed.ts`: seed categories → items → registry (mix of inventory / fixed_asset / consumable) → stock balances → movements → installations → maintenance → disposals → depreciation schedules.
- `demo-reset` edge function: include asset tables in cleanup (idempotent).
- Tests:
  - Unit: stock delta, disposal gain/loss, status flow, type-guard, RPC idempotency (mocked).
  - E2E (`e2e/assets-lifecycle.spec.ts`): create item → purchase → transfer → install → maintenance → dispose → verify ledger + audit + reports.
- i18n: run `scripts/i18n-check.mjs`, add missing keys.

## Phase 6 — Hardening & guardrails

- RLS audit on all new/changed tables (office isolation), via `scripts/rls-audit.sql`.
- Pagination on movement & audit lists (server-side `range()`).
- Dashboard cards: counts by `asset_type`, low-stock alerts (cached via React Query staleTime).
- Permission matrix doc update.
- Run `supabase--linter`, fix any new warnings.
- Final regression smoke: irrigation invoices, payments, cashbook, ledger integrity unaffected.

---

## Technical notes

```text
DB additions only (no drops, no renames of existing columns):

assets
 + asset_type           text   default 'fixed_asset'
 + lifecycle_status     text   nullable (mirror trigger from current_status)

asset_movements / installations / maintenance / damages / disposals
 + deleted_at           timestamptz nullable

new RPCs (SECURITY DEFINER, idempotent via source_ref):
 - post_asset_purchase_journal(...)
 - post_asset_disposal_journal(...)
 - post_asset_maintenance_journal(...)   -- gated by settings flag

triggers:
 - assets_status_mirror      (current_status <-> lifecycle_status)
 - depreciation_type_guard   (block non-fixed_asset rows)
```

UI conventions stay identical: shadcn `Card / Table / Tabs / Dialog`, semantic tokens, `PageHeader`, `RequirePerm module="assets"`.

---

## What I'll do first if you approve

Ship **Phase 1** end-to-end (migration + sidebar rename + asset_type field & filters + tests). After that, say "next" to continue with Phase 2.