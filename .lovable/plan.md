# ধাপ ১ — Migration Plan: Supabase Cloud → Laravel 11 + MySQL 8 (VPS)

লক্ষ্য: backend layer swap। **কোনো working UI/route/feature ভাঙা যাবে না।** Frontend bridge দিয়ে `VITE_API_BASE_URL` থাকলে Laravel, না থাকলে Supabase fallback — Lovable preview অক্ষত থাকবে।

নির্ধারিত সিদ্ধান্ত:
- Domain: `mohammadkhani.com`
- DB: **MySQL 8** (NO Supabase, NO PostgreSQL)
- Module order: **Auth → সব core একসাথে**
- Data: **পুরো Supabase data → MySQL এ migrate**
- Super Admin: username `ismail162`, password `Admin@123`

---

## ১. বর্তমান Supabase ডাটাবেস ইনভেন্টরি (১১৭টি টেবিল)

মডিউল অনুযায়ী গ্রুপ করা হলো:

```text
Geo / Org        : divisions, districts, upazilas, unions, mouzas, patwaris, offices
Auth / RBAC      : profiles, user_roles, role_permissions, user_permissions,
                   permission_audit_logs, member_block_audit
Farmers          : farmers, farmer_notes, farmer_rejections, farmer_savings_plans,
                   farmer_otps, farmer_login_attempts, farmer_portal_sessions
Lands            : lands, land_types, land_history, land_relations, land_change_log,
                   land_transfers, land_transfer_recipients, land_note_attachments,
                   land_note_audit
Irrigation       : irrigation_* (categories, category_rates, charges, charge_settings,
                   rates, rate_overrides, rate_audit_logs, season_rates, season_types,
                   invoices, invoice_payments, invoice_audit, due_promises,
                   delay_fee_audit, sms_logs, cashbook_presets, cashbook_export_audit), seasons
Savings/Loans    : savings_plans, savings_transactions, savings_yearly_opening,
                   loans, loan_plans, loan_payments, loan_installments, loan_guarantors,
                   loan_discount_audit, loan_delay_fee_settings,
                   loan_installment_delay_audit, shares
Accounting       : accounts, accounting_periods, journal_entries, journal_entry_lines,
                   ledger_entries, vouchers, voucher_sequences, payments,
                   payment_allocations, expenses, cashbook_*, hand_cash_submissions,
                   bank_accounts, bank_transactions, office_incomes
Receipts         : receipts, receipt_counters, receipt_sequences, receipt_no_pool,
                   receipt_settings, company_settings, card_settings
Assets           : assets, asset_* (categories, stocks, purchases, movements,
                   installations, maintenance_logs/schedules, depreciation_*,
                   disposals, damage_reports, alerts, scan_logs, audit_logs)
SMS / QR / Misc  : sms_settings, sms_office_settings, sms_templates, sms_logs,
                   sms_provider_secrets, qr_tokens, qr_rotation_settings,
                   notifications, audit_logs, system_audit_logs, demo_operations_log,
                   developer_update_logs, import_audit_logs, voter_audit_logs,
                   background_retry_jobs, public_payment_intents
```

### Edge Functions (Supabase) → Laravel এ যা হবে

```text
admin-users, farmer-password-login, farmer-request-otp/verify-otp,
farmer-portal-data, farmer-submit-payment-intent     → Laravel Controllers
send-sms, sms-due-reminders, sms-delivery-report      → Laravel Jobs + SmsService
irrigation-* (cashbook-ledger, invoice-dues,          → Laravel Services
  payment-lifecycle, receipt-history)
ledger-check/reconcile, receipt-totals/verify         → Laravel Services + Commands
asset-depreciation-run, asset-alerts-scan             → Scheduled Commands (cron)
qr-resolve/rotate, farmer-card-*                       → Controllers
db-export / db-restore / data-integrity-scan          → Artisan Commands
process-retry-jobs                                     → Queue worker
```

---

## ২. PostgreSQL → MySQL Schema Mapping নিয়ম

| PostgreSQL feature | MySQL 8 প্রতিস্থাপন |
|---|---|
| `uuid` PK + `gen_random_uuid()` | `CHAR(36)` PK, Laravel `HasUuids` trait দিয়ে app-side generate |
| `jsonb` কলাম | `JSON` কলাম (MySQL native) |
| `bigint identity` / sequence | `BIGINT UNSIGNED AUTO_INCREMENT` |
| RLS policies (per-table) | **বাদ** — Laravel middleware: `CheckPermission`, `BranchScope` (office_id scoping) |
| `GRANT ... TO anon/authenticated` | **বাদ** — MySQL এ public schema নেই |
| DB triggers (updated_at, validation) | Laravel model `$casts`/Observers + `timestamps()` |
| DB functions (receipt no, reconcile) | Laravel Services (transaction + `lockForUpdate`) |
| sequences (receipt_sequences, voucher_sequences) | আলাদা counter টেবিল + atomic `lockForUpdate` সার্ভিস |
| `now()` defaults | `useCurrent()` / model timestamps |
| partial/expression CHECK | Laravel validation rules |
| Postgres enums | MySQL `ENUM` বা lookup টেবিল |

**Receipt/voucher numbering** (মাস-ভিত্তিক unique, multi-office): বর্তমানে `next_monthly_receipt_no` ফাংশন `ON CONFLICT` দিয়ে atomic — এটি Laravel এ `DB::transaction` + row-level `lockForUpdate` দিয়ে replicate হবে, যাতে concurrent payment এ ডুপ্লিকেট না হয়।

---

## ৩. ফোল্ডার ও আর্কিটেকচার

বর্তমানে রিপোতে একটা `backend/` Laravel scaffold আছে কিন্তু সেটি **pgsql + uuid/jsonb** এ। নির্দেশ অনুযায়ী নতুন MySQL-নির্ভর `erp-backend/` তৈরি হবে (অথবা বিদ্যমান `backend/` কে MySQL এ রূপান্তর — আপনার পছন্দ জানাবেন)।

```text
erp-backend/
  composer.json, artisan, bootstrap/, config/
    config/database.php   (DB_CONNECTION=mysql)
    config/sanctum.php, config/cors.php
  routes/api.php
  app/Http/Controllers/   (Auth + প্রতি module)
  app/Http/Middleware/    CheckPermission.php, BranchScope.php
  app/Models/             প্রতি টেবিলের Eloquent model (HasUuids)
  app/Services/           numbering, accounting, irrigation, sms ...
  database/migrations/    সব টেবিল MySQL syntax
  database/seeders/       Super Admin (ismail162), roles, geo, demo
  .env.example            DB_CONNECTION=mysql, APP_URL, SANCTUM_*

deploy/vps/
  install.sh   (Nginx, PHP 8.2, MySQL 8, Node 20, Certbot, clone, migrate)
  update.sh    (git pull + migrate + cache clear)
  deploy.sh    (frontend build → Laravel public/)

Frontend (ভাঙা যাবে না):
  src/lib/laravel-auth.ts                      token storage + getApiBaseUrl()
  src/integrations/supabase/laravel-bridge.ts  Supabase call intercept → Laravel
  src/lib/*-api.ts                             module-wise API wrapper
.env.production.example   VITE_API_BASE_URL=https://mohammadkhani.com/api
```

---

## ৪. পর্যায়ক্রমে কাজ (প্রতি ধাপে আপনার approval নেব)

```text
ধাপ ১  ✅ (এই plan) — table inventory + MySQL mapping
ধাপ ২  erp-backend/ skeleton + Sanctum + Auth (login/me/logout) + Super Admin seeder
ধাপ ৩  Frontend bridge: laravel-auth.ts (VITE_API_BASE_URL থাকলে Laravel,
        নাহলে Supabase) — preview অক্ষত
ধাপ ৪  সব core module: migrations → models → controllers → routes → frontend wrapper
        (Auth/RBAC, Geo, Farmers, Lands, Irrigation, Savings/Loans, Accounting,
         Receipts, Assets, SMS/QR)
ধাপ ৫  deploy/vps/install.sh + SETUP_GUIDE_BN.md
ধাপ ৬  Data migration script (PG → MySQL, FK-safe order) + local test + VPS deploy
```

---

## ৫. ঝুঁকি ও নিরাপত্তা

- প্রতিটি migration **MySQL-safe**: `AUTO_INCREMENT`/`CHAR(36)`, JSON (JSONB নয়), no trigger, no stored proc, no PG-only syntax।
- Authorization সম্পূর্ণভাবে Laravel middleware-এ — RLS এর বদলে `BranchScope` (office isolation) + `CheckPermission` (RBAC)।
- Roles আলাদা `user_custom_roles` টেবিলে — কখনো `users`/`profiles` এ নয়।
- Secrets শুধু `.env` (APP_KEY, DB, SANCTUM_STATEFUL_DOMAINS, CORS, SMS) — কোডে hardcode নয়।
- Module identifier strictly lowercase।
- Frontend bridge fallback থাকায় Lovable preview ও বর্তমান Supabase flow চলতে থাকবে যতক্ষণ না cutover।

---

### আপনার সিদ্ধান্ত দরকার (Step ২ শুরুর আগে)

1. নতুন backend ফোল্ডার `erp-backend/` (নির্দেশ অনুযায়ী নতুন) — নাকি বিদ্যমান `backend/` কে MySQL এ রূপান্তর করব?
2. এই plan অনুমোদন দিলে **ধাপ ২ (skeleton + Auth + Sanctum + Super Admin seeder)** শুরু করব।
