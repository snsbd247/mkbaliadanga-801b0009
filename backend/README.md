# MK Cooperative ERP — Laravel 11 API Backend

Laravel 11 + Sanctum token auth + MySQL 8 backend that replaces the
Supabase/PostgreSQL layer. Authorization is done in middleware
(`CheckPermission`, `BranchScope`) instead of Postgres RLS/GRANT.

## Status — complete

All modules implemented and matched to the React frontend API contract:

- **Auth & Admin:** Sanctum login/me/logout, logout-all, password forgot/reset,
  Users, Roles/Permissions, Offices, Audit logs.
- **Farmer portal:** code login + phone/OTP login (`/api/farmer/auth/*`, `/api/farmer/me`).
- **Modules:** Farmers, Lands, Geo, Irrigation (seasons/rates/invoices),
  Savings, Loans/Loan plans, Accounting (chart of accounts + double-entry journals),
  Assets, Payments (multi-allocation receipts), SMS, QR tokens.
- **Reports:** trial balance, profit & loss, balance sheet, cashbook.
- **Data migration:** `php artisan migrate:legacy` imports existing Supabase data.
- **Seeders:** all module permissions + super admin (`ismail162` / `Admin@123`).

## Local setup

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# set DB_* in .env, then:
php artisan migrate --seed
php artisan serve   # http://127.0.0.1:8000
```

## Auth endpoints

| Method | Path         | Body                          | Auth        |
|--------|--------------|-------------------------------|-------------|
| POST   | /api/login   | `{ login, password }`         | none        |
| GET    | /api/me      | —                             | Bearer token|
| POST   | /api/logout  | —                             | Bearer token|

`login` accepts username **or** email. Returns `{ token, user }`.

## ID convention

All primary/foreign keys are `CHAR(36)` UUIDs to preserve relationships when
migrating existing Supabase data.

## Legacy data migration (Supabase → MySQL)

After `php artisan migrate --seed`, import existing data:

```bash
# set PG_* in .env (Supabase Postgres connection), then:
php artisan migrate:legacy             # import all mapped tables (FK-safe order)
php artisan migrate:legacy --only=farmers,lands
php artisan migrate:legacy --truncate  # wipe targets before import
```

UUID `id`s are preserved (upsert on `id`), so the command is idempotent and
re-runnable. Unmapped source columns are folded into each target's `extra`
JSON column when present.
