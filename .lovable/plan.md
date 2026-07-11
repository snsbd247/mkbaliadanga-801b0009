## Goal

Give a single place to preview a receipt, tune margins + font scale + paper, confirm it looks right, then export — and guarantee every receipt type uses the same settings without excessive side gaps.

## What already exists (reuse, don't rebuild)

- `src/lib/receiptLayoutSettings.ts` — paper size (a5/a4), orientation, fit-to-page, page/bottom/holding padding, presets, persistence.
- `src/components/receipts/ReceiptSettingsButton.tsx` — popover with all the above controls.
- `src/lib/bnReceipts.ts` — `previewBnReceiptPdf` / `downloadBnReceiptPdf`, irrigation two-up rendering.
- `IrrigationReceiptPreviewDialog.tsx` — iframe PDF preview.

## Changes

### 1. New settings fields
In `receiptLayoutSettings.ts`:
- Add `fontScale` (0.8–1.4, default 1.0) and `sideMarginMm` (0–15, default per current).
- Lower padding clamp minimums (page 8, bottom 6) so gaps can shrink further than today's floor of 24/12.
- Add `"letter"` to `PaperSize` and to preset/clamp logic.

### 2. Apply settings everywhere
In `bnReceipts.ts`:
- Multiply the hardcoded row/label/signature font sizes by `fontScale`.
- Use `sideMarginMm` for the two-up/side margins instead of the fixed `IRRIGATION_RECEIPT_PAGE.margins`.
- Support `letter` paper in `renderPdf`.
Confirm loan/savings/office-income receipts read the same `getReceiptLayoutSettings()` path (they already do) so nothing prints with wide side gaps.

### 3. Dedicated print-preview page
New route `src/pages/ReceiptPrintPreview.tsx` (added to router):
- Left: live PDF preview via `previewBnReceiptPdf` using a sample receipt of each type (type selector: Irrigation / Savings / Loan).
- Right: controls — paper (A4/A5/Letter), orientation, side margin (mm), font scale slider, fit-to-page toggle, page/bottom padding. All write through `setReceiptLayoutSettings` + `scheduleReceiptLayoutPersist` and re-render preview on every change.
- Buttons: Download PDF, Print. Reuse `ReceiptSettingsButton` logic where possible.

### 4. Automated tests
`src/lib/__tests__/receiptLayoutSettings.spec.ts`:
- fontScale/sideMargin/letter clamp + default assertions.
- A test that renders the receipt HTML (via the existing `buildHtml`/test export) and asserts font-size scales up when `fontScale` increases and side margin value flows into the PDF margins.
- Extend existing layout tests to cover Letter paper page dimensions.

## Technical notes

- Preview re-render: debounce control changes (~150ms) before calling `previewBnReceiptPdf` to avoid thrashing html2canvas.
- Keep irrigation official receipt fixed two-up behavior; font scale still applies inside each copy.
- All colors via existing semantic tokens; no hardcoded colors.
