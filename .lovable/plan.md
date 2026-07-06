# সেচ ইনভয়েস — Wizard, Preview, Validation, Exports & Pay flow

All work stays in the existing `src/pages/IrrigationInvoices.tsx` (the `GenerateTab` and `InvoiceListTab`) plus small helpers. No schema/backend changes needed — the payment prefill route (`/payments?farmer=…&irr=…`) already exists.

## 1. Step-by-step invoice creation wizard
Convert `GenerateTab`'s flat form into a 4-step wizard (local `step` state, no new deps):
- **Step 1 — Season** (required)
- **Step 2 — Office** (optional) + Due date (required) + fallback rate + default category
- **Step 3 — Land types** (the existing land-type filter chips)
- **Step 4 — Preview & confirm** (existing preview table + create button)

A progress header shows the 4 steps; Back/Next buttons gate progress. Next is disabled until the current step's required fields validate. Existing preview/create logic is reused unchanged — only the layout is reorganized into steps.

## 2. Clearer "excluded lands" reporting in preview
Today the preview only shows a count (`X lands had no rate — skipped`). Change the preview collection loop to also collect an `excluded` list with `{ dag, mouza, land_type_name, reason }` where reason is one of:
- জমির ধরনে রেট কনফিগ করা নেই (no season rate + no fallback)
- জমির ধরন নির্বাচিত ফিল্টারে নেই
- ইতিমধ্যে ইনভয়েস আছে (skip-existing)

Render an expandable "বাদ পড়া জমি (N)" panel listing each excluded land with its reason, so it's obvious what to fix.

## 3. Inline field validation
Add per-field error state in the wizard. Show inline red messages when:
- Season not selected
- Due date empty or in the past
- (Step 3) no land type selected

Block Next/Create while errors exist, with a top-of-step error summary (reusing the pattern of `FormErrorSummary`).

## 4. Preview PDF + Excel export before confirming
Add two buttons in the Step-4 preview toolbar:
- **Export Excel** — reuse `exportInvoicesXLSX` from `@/lib/irrigationExports`, mapping the preview rows to the same column shape.
- **Export PDF** — a printable draft (marked "খসড়া / DRAFT") built from the preview rows, reusing the existing invoice PDF/print helpers used by `InvoiceListTab`.

These run on preview data before any invoice is created.

## 5. Direct "Pay" action from each generated invoice
In `InvoiceListTab`'s row actions, add a **Pay** button (money icon) shown when the invoice has due > 0 and is not cancelled. It navigates to:
```text
/payments?farmer=<farmer_id>&irr=<invoice_id>
```
The Payments page already reads `farmer` and `irr` params and preloads the allocation with the correct due amount — so the amount is prefilled automatically.

## Technical notes
- No new packages; wizard is local state.
- Reuse `loadSeasonRateMap`, `resolveRateForLand`, `exportInvoicesXLSX`, and existing PDF preview builder.
- The earlier `[object Object]` rates line is already fixed.
- The `get_land_billing_split` RPC toast is a separate pre-existing backend gap; I'll confirm whether it blocks preview and, if so, guard it so the wizard still works (surface as a soft warning, not a hard failure).
