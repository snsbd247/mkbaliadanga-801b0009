# Irrigation Ecosystem v2 — Phased Plan

বিশাল স্কোপ। এক রিকোয়েস্টে সব করলে regression risk বেশি — তাই ৬টি ফেজে ভাগ করছি, প্রতিটা নিজে নিজে shippable। আপনি বললেই Phase 1 দিয়ে শুরু করব, অথবা ক্রম পাল্টে দিতে পারি।

---

## Phase 1 — Irrigation Analytics Charts (`/irrigation/reports`)
- `recharts` (already in deps) দিয়ে ৪টি চার্ট যোগ:
  - Season-wise Collection (stacked bar: payable / paid / due + collection %)
  - Land-type Comparison (grouped bar)
  - Monthly Trend (line: invoiced vs collected, last 12 months)
  - Overdue Aging (pie: 0-30 / 31-60 / 60+ days)
- ফিল্টার: office, season, date range, land-type — সবগুলো চার্ট ও existing summary শেয়ার করবে।
- বাংলা labels, responsive container, lazy-load charts।
- Backend: একটা নতুন SECURITY DEFINER RPC `irrigation_report_aggregates(office_id, season_id, from, to)` — current RLS-honored views এর উপর। Existing report data ভাঙবে না।

## Phase 2 — FarmerDashboard Irrigation Table (search / filter / sort)
- Client-side search (invoice no / season / land type / mouza / status)
- Filters: season dropdown, status (Pending / Partial / Paid / Overdue / Cancelled), date range
- Sort headers: due date, amount, status, paid date, created
- "Overdue" derived from `due_date < today AND due_amount > 0`
- শুধু UI/state — `farmer-portal-data` edge function unchanged।

## Phase 3 — Direct Payment from FarmerDashboard
- Row checkbox + selection bar + "পেমেন্ট করুন" button
- Validation: skip cancelled / fully-paid / negative-due
- Navigate `/payments?farmer={id}&irrigation_invoices={id1,id2}` (hash so URL stays short if many)
- Payments page reads param, preloads invoices, auto-fills total, locks against duplicate (idempotency_key on submit + recheck due before insert)
- DB: কোনো schema পরিবর্তন নাই; existing `irrigation_invoice_payments` flow reuse।

## Phase 4 — SMS Tracking (`irrigation_sms_logs` + `/sms/logs` page)
- নতুন টেবিল `irrigation_sms_logs` (RLS: office-scoped read, super_admin manage)
  - columns per spec; FK to invoices/farmers/offices
  - indexes: (office_id, sent_at DESC), (status), (irrigation_invoice_id)
- `sms-due-reminders` & `send-sms` edge functions কে wrap: প্রতিটা attempt log করবে (Pending → Sent/Failed/Skipped, gateway response, retry_count)
- নতুন page `/sms/logs`:
  - search, status filter, invoice filter
  - "Retry" action (super_admin only) → re-invoke send-sms with same payload, increments retry_count
  - CSV export
  - detail drawer with full message + gateway response
- existing SMS settings/logs page touch করব না, এটা নতুন page।

## Phase 5 — Advanced Export System (CSV / Excel / PDF)
- Reusable `<ExportDialog>` component:
  - column picker (checkbox list, presets save to localStorage per module)
  - format selector (CSV / Excel / PDF)
  - "respect current filters" toggle (default on)
- Backend helper `lib/exports/buildExport.ts`:
  - CSV: UTF-8 BOM (Bengali safe)
  - Excel: `xlsx` (already pinned), bn-aware number format
  - PDF: existing pdfmake + Bengali font already wired
- Wire into Irrigation Reports + Invoices first; other reports later (additive)।

## Phase 6 — Farmer Profile Data Consistency Audit
- Smoke-check করব Savings / Lands / Irrigation / Payments tab queries:
  - missing FKs (already added payments→offices; will check lands, irrigation_invoices, savings_transactions joins)
  - RLS office isolation verify (run `scripts/rls-audit.sql` + new vitest cases)
  - schema cache (PostgREST `notify pgrst` after FK add) — already triggered by migration
- Add indexes where slow (e.g. `irrigation_invoices(farmer_id, deleted_at)`, `payments(farmer_id, created_at DESC)`) only if missing।
- Vitest coverage:
  - dashboard filter/sort
  - payment-flow guard (cancelled/paid invoice rejection)
  - SMS log status transitions
  - export column projection
- Playwright e2e (opt-in CI gate already in place):
  - dashboard → select invoices → payments → success
  - SMS log retry visible
  - chart renders with non-empty data

---

## Cross-cutting guardrails
- কোনো existing migration / RPC / edge function signature পরিবর্তন হবে না — শুধু additive।
- Each phase ends with: typecheck + vitest + manual smoke on `/irrigation/reports`, `/farmers/:id`, `/sms/logs`।
- Backward-compat tests থেকে যা আছে (receipt verify, ledger integrity, savings, loans) — কোনোটাই pre/post diff এ ভাঙবে না।

---

## প্রশ্ন (শুরুর আগে)
1. **শুরু কোথা থেকে?** Phase 1 (charts) থেকে যাব নাকি আপনার priority আলাদা?
2. **SMS gateway**: existing `send-sms` function-এর gateway response কি raw JSON সংরক্ষণ করব, না সংক্ষেপে status code + message?
3. **Direct payment**: একসাথে multiple invoice select করে এক payment receipt, নাকি প্রতিটা invoice আলাদা receipt? (existing `irrigation_invoice_payments` allocation একাধিক invoice support করে — first option সহজ ও clean।)
