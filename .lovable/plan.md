# Plan — Land Management & Farmer Account Number Upgrades

A multi-part upgrade across DB, UI, and tests. Delivered in 9 grouped slices that map 1:1 to your numbered requirements. Backward compatibility preserved at every step.

---

## 1. Land CRUD (Edit + Delete) — `FarmerDetail.tsx`
- Add **Edit** and **Delete** buttons to each land row in the Lands tab.
- **Edit dialog**: reuses Add-Land form; pre-fills `LocationPicker` from `mouza_id` (resolves ancestors via DB lookup), supports cascade reset on close, disables inputs while saving.
- **Delete**: shadcn `AlertDialog` confirmation. On confirm:
  - Block delete if land is referenced by `irrigation_charges` (count check) → toast error with count.
  - Otherwise call `supabase.from("lands").delete()` (RLS already enforces office scope).
- Toast success/error via sonner.

## 2. Land Export (PDF + Excel)
- New file `src/lib/landExport.ts`:
  - `exportLandsPdf(farmer, lands)` → uses existing `jspdf` + `jspdf-autotable` (already used in `paymentReceiptPdf.ts`).
  - `exportLandsExcel(farmer, lands)` → uses `xlsx` (verify dep; add if missing).
- Columns: Account No, Farmer Name, Division → District → Upazila → Union → Ward → Village → Mouza, Dag No, Land Size, Owner Type, Field Type.
- Buttons in Lands tab header: "Export PDF" / "Export Excel".

## 3. Location Summary Display (Lands list)
- Add new column **Location** showing breadcrumb `Division › District › … › Mouza`.
- Implementation: enrich land query with `mouzas(name, ward_id, wards(name, village_id, villages(name, ...)))` via PostgREST nested select **OR** add an SQL view `lands_with_location`. Prefer view for reuse in exports + reports.
- Migration: `CREATE VIEW public.lands_with_location AS SELECT l.*, div.name AS division_name, dis.name AS district_name, ... FROM lands l LEFT JOIN mouzas m ON ... LEFT JOIN villages v ON ... LEFT JOIN wards w ... LEFT JOIN unions u ... LEFT JOIN upazilas up ... LEFT JOIN districts d ... LEFT JOIN divisions div ...`.

## 4. Irrigation Auto-Calculation — `Irrigation.tsx`
- When user picks `land_id` + `season_id`, auto-fetch:
  - `lands.land_size`
  - season-based rate (new table `irrigation_rates(season_id, base_per_size, canal, maintenance, other)` or reuse existing per-office config — investigate during impl).
- Compute `base_charge = land_size * rate`, populate `total = base + canal + maintenance + other + previous_due + penalty`, write `due_amount = total - paid_amount`.
- Each land already has its own `irrigation_charges` row → due tracking per land works today; just ensure ledger entry insert hook fires (existing trigger or via code).

## 5. Searchable Farmer Picker (Land Relations)
- New component `src/components/farmers/FarmerSearchSelect.tsx`:
  - shadcn `Command` + `Popover` based combobox.
  - Debounced query against `farmers` table: `or(farmer_code.ilike.%q%, member_no.ilike.%q%, mobile.ilike.%q%, name_en.ilike.%q%)`, limit 20.
  - Renders `Name • Code • Mobile`.
- Integrate in `LandRelations.tsx` (Add Relation flow) and any "Add Land" entry point that needs farmer selection. Existing FarmerDetail flow already has farmer context — unchanged.

## 6. Unique Farmer Account Number
- Migration:
  - `ALTER TABLE farmers ADD COLUMN account_number text;`
  - Backfill existing rows: `UPDATE farmers SET account_number = farmer_code WHERE account_number IS NULL;` (then user can regenerate).
  - `CREATE UNIQUE INDEX farmers_account_number_key ON farmers(account_number);`
  - DB function `generate_farmer_account_number(office_id, created_at)` returning formatted string `YYMM<office_seq><random4>` (e.g., `2401510064476`).
  - Trigger `BEFORE INSERT` on `farmers`: if `account_number IS NULL`, set via the function.
- UI: show `account_number` on FarmerDetail header, Farmers list, receipts, reports.

## 7. System-Wide Display Update
- Replace user-facing `farmer_code` displays with `account_number ?? farmer_code` fallback in:
  - `Farmers.tsx` table, `FarmerDetail.tsx` header, `Payments.tsx`, `Receipts/PDF templates`, `Reports/*`.
- Search inputs in Farmers/Payments now also match `account_number`.
- `farmer_code` kept intact internally (no breaking change).

## 8. E2E Tests
- Extend `src/pages/__tests__/Farmers.dialog.test.tsx` with land Add/Edit/Delete covering cascade reset.
- New `src/pages/__tests__/FarmerDetail.lands.test.tsx`:
  - Open Add Land dialog → cascade Division→…→Mouza required → save.
  - Reset on close.
  - Delete with confirmation.
- Playwright spec `e2e/land-crud.spec.ts` covering full happy path + delete.

## 9. Non-Breaking Guarantees
- All new columns nullable with sensible defaults; no existing column types changed.
- Views are additive.
- `farmer_code` retained; `account_number` is additive.
- RLS policies unchanged on lands/irrigation; new view inherits RLS via `security_invoker=on`.
- After each migration: run `npm test` for existing suites (Farmers, FarmerDashboard, NotificationBell, Locations) to confirm green.

---

## Suggested Execution Order
1. Migration: `account_number` + `lands_with_location` view.
2. Land CRUD (edit/delete) + Location summary column.
3. Land export (PDF/Excel).
4. Searchable FarmerSelect + integrate into LandRelations.
5. Irrigation auto-calc.
6. System-wide `account_number` display swaps.
7. Tests (unit + e2e).
8. Regression run + smoke check Savings/Loans/Irrigation/Reports.

## Open Questions Before Starting
- **Account number format**: confirm exact rule. Example `2401510064476` looks like `YY(24) MM(01) office(5100) seq(64476)`. Should I:
  - (a) Use `YYMM` + office short code + 5-digit incremental seq, OR
  - (b) Keep your sample exactly (13 digits, last 5 random)?
- **Irrigation rate source**: do per-season rates already exist somewhere (e.g., `seasons` extra columns or office settings), or should I create a new `irrigation_rates` table keyed by `(office_id, season_id)`?
- **Excel library**: OK to add `xlsx` (SheetJS community) as a dependency? It's ~400KB but standard.

I'll proceed once you confirm the three points above (or say "use defaults" and I'll pick sensible ones).
