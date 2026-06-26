# Billing Split Preview, Integrity & Access Control

Five related additions across the irrigation/land-transfer and admin areas. All work reuses existing helpers (`resolveBillingSplits`, `get_land_billing_split` RPC, `checkLandTransferIntegrity`, `usePermissions`, `RequireRole`) so no schema changes are needed.

## 1. Billing Split Preview page
A new page to verify owner-remainder vs borga-area charges before submitting payments.

- New route `/irrigation/billing-split` (gated by `RequireRole roles={["admin","super_admin"]}` plus `usePermissions().can("irrigation")`).
- Page (`src/pages/BillingSplitPreview.tsx`): pick a season + farmer (or land), call `resolveBillingSplits(land_id, as_of)` for each of the farmer's lands, and render a table:
  - Land (dag/mouza), Total area, Borga-given area, Owner remainder, per-sharecropper area, computed charge per party using the active season rate.
  - Totals row; a clear note that this is a preview only (no writes).
- Add a "Billing Split Preview" link in the irrigation section nav/menu.

## 2. Stronger demo seeding + integrity report
- Extend the Demo Manager seeding so borga/transfer scenarios populate `land_relations` (owner intact) rather than separate borgadar `lands` rows, matching the new single-source-of-truth model.
- Add post-import assertions in `LandTransferVerifyCard` that validate the `land_relations` model: each borga has a relation on a live owner land, owner area is never shrunk, no orphan borgadar land rows, relation areas ≤ owner land size. Surface these as extra integrity checks in the existing report + run log.

## 3. Role-gate export PDF/Excel generation
- In `LandTransferVerifyCard` and `IntegrityRuns`, wrap the Excel/PDF export buttons and the export handlers with an Admin/Super-Admin check (`isAdmin || isSuper`). Non-authorized users see the buttons disabled/hidden and the handler returns early with a toast.

## 4. Filters on the admin run-log page
`src/pages/admin/IntegrityRuns.tsx` gets a filter bar:
- Office (Select from offices), Run type (auto/manual), Status (completed/failed), and date-from / date-to inputs.
- Filtering applied client-side over the loaded rows (and passed to the query `limit`), with a Reset button.

## 5. Access control for deep links
- Confirm `/admin/integrity-runs` stays behind `RequireRole`. Add the same `RequireRole` wrapper to the new billing-split route.
- Export handlers (used by both the card and run-log, including any future detail deep link) re-check role at call time so a direct/deep link cannot trigger generation for unauthorized roles.

## Technical notes
- No DB migration required — all data already exists in `land_relations`, `land_transfer_integrity_runs`, `offices`, and the `get_land_billing_split` RPC.
- Reuse `exportIntegrityExcel`/`exportIntegrityPdf` unchanged; only their call sites get role checks.
- Permission source of truth: `useAuth().isAdmin/isSuper` and `usePermissions().can("irrigation")`.
