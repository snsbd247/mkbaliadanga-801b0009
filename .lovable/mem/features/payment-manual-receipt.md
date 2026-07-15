---
name: Payment manual receipt override
description: Admin can backdate a payment and type a receipt no to fill a gap; validated so the auto serial counter never advances
type: feature
---

Payments page allows admin / super_admin to override two fields when receiving:
1. Receipt # — must fill a gap: strictly less than BOTH `receipt_settings.receipt_serial_start` and `max(used numeric receipt_no)`. Otherwise `would_break_serial`. Non-numeric manual codes always OK (never touch serial). Duplicates blocked.
2. Manual date — becomes `created_at` + `occurred_at` (noon local). Affects cashbook day, reports, receipt PDF, but not the receipt number sequence.

Server RPC: `public.validate_manual_receipt_no(_no text)` returns (status, reason, next_serial, max_used).
Client helper: `src/lib/manualReceiptValidation.ts` — `validateManualReceiptNo` (RPC + client fallback) and pure `checkManualReceiptNoLocal` (tested).

`next_serial_receipt_no()` is intentionally unchanged — it returns `GREATEST(v_start, max_used+1)`; a gap-fill number is smaller than both, so the counter can never advance because of manual entries.

Non-admin users cannot type an override (input disabled).
