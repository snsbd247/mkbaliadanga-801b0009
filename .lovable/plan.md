## Goal

Wipe all transactional/demo data, keep admin users + system settings, top up the Rajshahi location hierarchy down to union/ward/mouza level, and seed a realistic demo dataset (farmers, lands, savings, loans, irrigation, ledger, QR tokens) with full referential integrity.

## Current state (verified)

- Divisions (8) and districts (64, all 8 Rajshahi districts present) and upazilas (492) are already fully seeded nationally.
- Rajshahi division has all 8 districts with upazilas already in place.
- Sparse: unions (5), wards (9), mouzas (5) — need to be expanded for Rajshahi.
- Existing demo: 10 farmers, 10 lands, 5 savings, 1 loan, 3 irrigation, 24 ledger entries, 0 qr_tokens — all to be cleared.
- Admin/system to preserve: `profiles` (1), `user_roles` (2), `offices` (1), `company_settings`, `receipt_settings`, `sms_*` settings, `accounts` (chart of accounts), `seasons`, `role_permissions`, `qr_rotation_settings`.

## Plan

### Step 1 — Safe data reset (one migration)

Wrap in a single transaction. Use `TRUNCATE ... RESTART IDENTITY CASCADE` in dependency order. Tables cleared:

- `qr_tokens`, `farmer_otps`, `farmer_portal_sessions`
- `payment_allocations`, `payments`, `loan_payments`, `receipts`
- `irrigation_charges`, `loans`, `savings_transactions`, `savings_yearly_opening`, `shares`
- `ledger_entries`, `journal_entry_lines`, `journal_entries`
- `expenses`, `notifications`, `sms_logs`, `audit_logs`
- `land_relations`, `lands`, `farmers`

Tables explicitly preserved: `profiles`, `user_roles`, `user_permissions`, `role_permissions`, `offices`, `company_settings`, `receipt_settings`, `sms_office_settings`, `sms_provider_secrets`, `sms_settings`, `accounts`, `seasons`, `qr_rotation_settings`, `accounting_periods`, and the entire location hierarchy.

### Step 2 — Top up Rajshahi location hierarchy

Insert (idempotent, `ON CONFLICT DO NOTHING` on existing unique keys):

- ~3–5 representative **unions** per upazila across all 8 Rajshahi districts (~250 unions total) with English + Bangla names.
- ~9 standard **wards** per seeded union.
- ~2–3 **mouzas** per seeded union with realistic JL numbers.

This stays well within practical seed size while giving every Rajshahi upazila navigable child data. Existing 5 unions / 9 wards / 5 mouzas remain untouched.

### Step 3 — Seed demo data (single insert script)

All farmers attached to `office_id` = the existing single office, distributed across Rajshahi districts/upazilas/unions/wards/mouzas.

- **30 farmers**: realistic Bangla + English names, unique `farmer_code` (`MK-0001`…`MK-0030`), valid mobile (`017xxxxxxxx`), NID, address, photo placeholder URL, location FKs filled, `created_by` = first super_admin.
- **Lands**: 1–2 per farmer, mix of `field_type` and `owner_type`, sizes 0.3–3.5 acres, mouza_id linked.
- **Savings**: 3–8 transactions per farmer (mix `deposit`/`withdrawal`), realistic amounts ৳200–৳5,000, dates spread over last 12 months, `status='approved'`.
- **Loans**: ~15 loans across farmers — 5 active (no payments), 5 partially paid (loan_payments cover 30–60%), 5 fully paid; `interest_rate` 8–12%, `total_payable` computed.
- **Loan payments**: rows in `loan_payments` matching the partial/completed loans.
- **Irrigation charges**: 1–2 per farmer for current season (`per_size` basis), with `paid_amount` random portion of `total`, leaving accurate `due_amount`.
- **Receipts + payment_allocations**: generated for every payment so receipt module works.
- **Ledger entries**: insert matching debit/credit pairs for each savings deposit/withdrawal, loan disbursement, loan payment, irrigation charge, and irrigation collection — using existing accounts in the chart of accounts. Trial balance must net to zero.
- **QR tokens**: one active token per farmer (random 32-char), `revoked=false`, no expiry.

### Step 4 — Consistency verification

After insert, run validators in the same migration block:

- Every `lands.farmer_id`, `loans.farmer_id`, `savings_transactions.farmer_id`, `irrigation_charges.farmer_id`, `qr_tokens.farmer_id` resolves.
- `SUM(debit) = SUM(credit)` in `ledger_entries`.
- Each loan: `principal + interest - SUM(loan_payments.amount) = outstanding` matches expected status.
- Each farmer has exactly one active QR token.

If any check fails, the transaction rolls back.

### Step 5 — Safety guarantees

- No schema changes — only data DML inside one migration.
- Admin auth rows in `auth.users`, `profiles`, `user_roles` are never touched.
- All existing settings tables untouched.
- Idempotent location top-up uses `ON CONFLICT DO NOTHING` against existing unique constraints (`upazilas(district_id,name)`, `unions(upazila_id,name)`, `wards(union_id,name)`).

## Technical details

- Delivered as **one Supabase migration** containing: TRUNCATE block → location upserts → demo seed → verification `DO $$ ... RAISE EXCEPTION` block.
- No frontend code changes required.
- `created_by` / `collected_by` set to the existing super_admin profile id (looked up via `(SELECT id FROM user_roles WHERE role='super_admin' LIMIT 1)`).
- Ledger postings use account codes already present in `accounts` (Cash, Savings Liability, Loan Receivable, Interest Income, Irrigation Income).

## Out of scope

- No new tables, columns, RLS, triggers, functions, or RPCs.
- No edge function changes.
- No UI changes.
