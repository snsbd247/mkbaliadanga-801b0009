# Hybrid Irrigation Rate Engine Refactor

A large, multi-phase change. I will deliver it in **safe, independently shippable phases** so existing invoices, receipts, ledgers, reports, QR verification, and exports keep working at every step.

---

## Guiding Principles

- **Additive only**: new tables + new nullable columns. No destructive migration on existing data.
- **Old invoices frozen**: historical `irrigation_invoices` rows keep their `calculation_snapshot` and never get re-priced.
- **Layered resolver**: `Manual Override → Category Rate → Land-Type Rate → Warning`.
- **Single source of truth**: a new `resolveIrrigationRate()` pure function used by UI + invoice generation + tests.
- **Bengali-first UI**, RLS preserved (office-scoped), audit trail on every override.

---

## Phase 1 — Schema Foundation (migration only, no UI break)

New tables:

```text
irrigation_categories
  id, office_id, code, name_bn, name_en,
  calculation_basis (per_shotok|per_bigha|flat|custom),
  allow_manual_negotiation bool,
  is_active bool, deleted_at, created_at, updated_at

irrigation_category_rates
  id, office_id, irrigation_season_id, irrigation_category_id,
  rate_type (per_shotok|per_bigha|flat|custom),
  rate numeric, unit text,
  is_negotiable bool,
  created_at, updated_at
  UNIQUE (office_id, season_id, category_id)

irrigation_rate_overrides
  id, irrigation_invoice_id, original_rate, overridden_rate,
  override_reason, approved_by, created_by, created_at
```

Add **nullable** columns to `irrigation_invoices`:

```text
irrigation_category_id     uuid null
irrigation_category_name   text null   -- snapshot
rate_source                text null   -- 'STANDARD' | 'CATEGORY' | 'MANUAL'
original_standard_rate     numeric null
applied_rate               numeric null
override_reason            text null
```

RLS: office-scoped read, admin/super manage — mirrors `irrigation_season_rates`.
Backfill: leave NULL for legacy rows; resolver treats NULL `rate_source` as `STANDARD`.

## Phase 2 — Rate Resolver Core (pure logic + tests)

- New `src/lib/irrigationRateResolver.ts` exporting `resolveIrrigationRate({ land, season, office, manualOverride? })` returning `{ source, rate, basis, categoryName?, warning? }`.
- Unit tests covering: manual wins, category wins over standard, fallback to land-type, "no rate" warning, negotiable flag.
- No UI/DB write changes yet — purely additive module.

## Phase 3 — Admin Master Data UI

- `src/pages/admin/IrrigationCategories.tsx` — CRUD list (Bengali-first), soft-delete.
- Extend `src/pages/IrrigationRates.tsx` with a **Categories** tab for per-season category rates next to the existing land-type rates tab. Existing land-type tab untouched.
- Audit entries via existing `logAudit()` (`module: "irrigation_rate"`).

## Phase 4 — Invoice Generation Integration

- Update `IrrigationInvoices.tsx` generation flow to call the resolver:
  - Per land: pick category if assigned for the season, else land-type rate.
  - "Manual rate" toggle on the generate dialog → opens reason + amount inputs.
  - On "no rate found": block with the required Bengali warning + 3 actions.
- Persist `rate_source`, `applied_rate`, `original_standard_rate`, `irrigation_category_name`, `calculation_snapshot` (extended).
- For MANUAL: also insert `irrigation_rate_overrides` row in the same transaction.

## Phase 5 — Receipt, Statement, QR, Dashboard

- Receipt PDF (`paymentReceiptPdf.ts`, `bnReceipts.ts`): show category name + a small "কাস্টম রেট" badge when `rate_source = MANUAL`. Layout unchanged for legacy invoices (fields are NULL → hidden).
- Farmer statement / IrrigationInvoicesTab: add small badges; same conditional rendering.
- QR verification + dashboard: read-only consumers — verify they tolerate the new optional fields (no schema-breaking joins).

## Phase 6 — Reports & Exports

- New report: `src/pages/reports/RateSourceReport.tsx` — splits collection by STANDARD / CATEGORY / MANUAL with PDF + CSV export.
- New report: `src/pages/reports/OverrideAuditReport.tsx` — who, original vs final, reason, season, farmer.
- Extend existing irrigation exports with `rate_source`, `category_name`, `override_reason` columns (appended at the end so existing column orders stay stable).

## Phase 7 — Demo / Import-Export

- Extend `demoPresets` and `demo-reset` edge function to seed:
  - 3 sample categories (ধানের চারা, সবজি, পুকুর)
  - season rates for them
  - 1 manual-override example invoice
- CSV templates updated for categories + category rates.

## Phase 8 — Tests

- Unit: resolver matrix, override audit insert, snapshot immutability.
- Integration: invoice generation across all 3 sources; legacy invoice still renders.
- E2E (Playwright): create category → set rate → generate invoice → pay → receipt shows badge → report totals match.
- Regression: existing irrigation tests must still pass untouched.

---

## Backward-Compatibility Checklist (verified each phase)

- Legacy invoices: `rate_source` NULL → UI treats as STANDARD, no badge, identical receipt.
- No NOT NULL added to existing columns.
- No rename / drop of existing columns.
- No RPC signature changes — new RPCs added with new names.
- Ledger posting unchanged (still posted from `payable_amount`).

---

## Delivery Order I Propose

I'll start with **Phase 1 + Phase 2** in this batch (schema migration + pure resolver + tests). After you approve the migration, I'll move phase-by-phase, pausing only if a phase needs a product decision.

Reply **"ok start"** (or "শুরু করেন") to begin Phase 1.
