# erp-backend — Laravel 11 + Sanctum + MySQL 8

Backend for **mohammadkhani.com** ERP. Replaces Supabase with a self-hosted
Laravel API + MySQL 8 on a VPS. Authorization is handled by Laravel middleware
(`CheckPermission`, `BranchScope`) — no RLS, no PostgreSQL-only features.

## Local bootstrap

```bash
cd erp-backend
cp .env.example .env
composer install
php artisan key:generate
# create MySQL db + user matching .env, then:
php artisan migrate --seed
php artisan serve --port=8000
```

Super admin (from `.env`): username **ismail162**, password **Admin@123**.

## Auth endpoints (ধাপ ২)

| Method | Path              | Auth        | Purpose                  |
|--------|-------------------|-------------|--------------------------|
| POST   | `/api/auth/login` | public      | login (identifier+password) → token |
| GET    | `/api/auth/me`    | bearer token| current user + roles + permissions |
| POST   | `/api/auth/logout`| bearer token| revoke current token     |
| POST   | `/api/auth/logout-all` | bearer | revoke all tokens        |

Login accepts `identifier` (email **or** username) + `password`.

## RBAC

- Roles in `custom_roles`, assigned via `user_custom_roles` pivot (never on `users`).
- Permissions named `module.action` (lowercase), e.g. `farmers.view`.
- `super_admin` & `developer` bypass all permission checks.

## Next steps

- ধাপ ৩: frontend bridge (`src/lib/laravel-auth.ts`)
- ধাপ ৪: per-module migrations/models/controllers/routes
- ধাপ ৫: `deploy/vps/install.sh` + `SETUP_GUIDE_BN.md`
- ধাপ ৬: PG → MySQL data migration script
