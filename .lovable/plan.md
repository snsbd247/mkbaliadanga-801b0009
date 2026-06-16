# Payment Module Improvements

Seven related changes to the সেচ (irrigation) and সেভিং (savings) payment flow. Grouped by area. Each is isolated so other modules (loan, cashbook, bank, report) stay untouched.

## 1. Richer info when selecting farmer's সেচ dues
When a farmer is selected for payment, the due list will also show, per due row:
- মালিকের নাম (owner name) — already loaded via `owner:farmers!owner_farmer_id`
- মৌজা (mouza) and জমির পরিমান (land size) — already loaded via `lands(mouza,land_size)`
- টাকা (due amount) — shown
So staff can confirm details with the farmer before collecting. This is a UI-only change in `IrrigationPaymentPanel.tsx` (add owner/mouza columns to the due table).

## 2. No rounding on land size (only money rounds)
Land amounts like `1.99` must stay exactly as entered — never rounded. Money keeps rounding. Audit land-entry inputs/format helpers to ensure `1.99` is preserved end-to-end (entry, storage, receipt). Only `money()`/rounding helpers apply to currency.

## 3. Auto-fill due amount on selection
When a farmer's due land is selected, its outstanding amount auto-populates so staff only press Pay/Confirm — no manual typing. In the structured panel the total is already auto-computed (`grandTotal`); we will verify the Quick/legacy entry path also auto-fills and remove the manual amount requirement there.

## 4. Admin-only post-payment receipt edit
Admins can edit a paid receipt's মৌজা, মালিক, জমির পরিমান, টাকা, জরিমানা after payment (to fix mistakes). Requires:
- A single serialized list of all paid receipts (সেচ + সেভিং) in one place.
- An admin edit dialog updating the receipt + linked records, writing an audit log entry of old/new values.

## 5. সেচ জরিমানা (penalty) entry field
Add an explicit জরিমানা input in the সেচ payment flow (the structured panel has delay-fee override; we will surface a clear penalty field that flows into `penalty_amount`/`delay_fee`).

## 6. Receipt void/cancel (admin) + report visibility
Admin can fully void a paid receipt. On void:
- Receipt is marked cancelled; the released serial can be reused by the next farmer OR remain permanently voided (your choice — see question).
- Collection report shows voided receipts flagged as বাতিল.

## 7. Savings Combination Payment — receipt option
Add a receipt (field) option to the existing savings Combination Payment so it can print/download a রশিদ like other flows.

## Database changes (require approval)
- Receipt void: add `cancelled_at`, `cancelled_by`, `cancel_reason` to the receipts/payments tables.
- Admin receipt edit audit: reuse existing `audit_logs`.
- Confirm `irrigation_invoices`/`receipts` already expose penalty fields (they do: `delay_fee`, `penalty_amount`).

## Open questions
1. Voided serial: reuse for the next farmer, or keep the number permanently voided (gap in sequence)?
2. Item 4/6 "admin": super_admin + admin both, or super_admin only?
3. Should item 1's extra info also appear on the printed receipt, or only on-screen during collection?

## Suggested order
Start with the low-risk UI items (1, 2, 3, 5), then the DB-backed items (4, 6), then savings (7). I can implement them incrementally so each is verifiable before the next.
