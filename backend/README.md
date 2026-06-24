# MK Cooperative ERP — Laravel 11 API Backend

Laravel 11 + Sanctum token auth + MySQL 8 backend that replaces the
Supabase/PostgreSQL layer. Authorization is done in middleware
(`CheckPermission`, `BranchScope`) instead of Postgres RLS/GRANT.

## Status

- **Step 2 (done):** skeleton, Sanctum auth (`/api/login`, `/api/me`, `/api/logout`),
  users/roles/offices migrations, super admin seeder (`ismail162` / `Admin@123`).
- Module migrations/controllers (farmers, lands, irrigation, savings, accounting,
  assets) are added in later steps.

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
