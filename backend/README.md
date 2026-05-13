# MK Baliadanga — Laravel 11 Backend (Phase 1)

This is the new Laravel API backend that will gradually replace the Supabase + Prisma stack.
Phase 1 ships **only the foundation**: Docker stack, auth, RBAC, multi-tenant scope, base
migrations, accounting service, queue jobs, scheduler, and admin seeder. Frontend still
runs on Supabase until Phase 2 module-by-module rewrite.

## Quick start (local Docker)

```bash
cd backend
cp .env.example .env
# edit ADMIN_EMAIL / ADMIN_PASSWORD / DB_PASSWORD / REDIS_PASSWORD / AWS_* / SMS

docker compose up -d --build
docker compose exec app bash -lc "composer install --no-interaction"
docker compose exec app bash -lc "scripts/setup.sh"
```

API: <http://localhost:8080/api/auth/login>
Health: <http://localhost:8080/health>

## Endpoints (Phase 1)

| Method | Path                              | Auth          |
| ------ | --------------------------------- | ------------- |
| POST   | `/api/auth/login`                 | public        |
| GET    | `/api/auth/me`                    | sanctum       |
| POST   | `/api/auth/logout`                | sanctum       |
| POST   | `/api/auth/password/forgot`       | public        |
| POST   | `/api/auth/password/reset`        | public        |
| POST   | `/api/farmer/auth/request-otp`    | public        |
| POST   | `/api/farmer/auth/verify-otp`     | public        |
| GET    | `/api/farmers`                    | sanctum+office|
| POST   | `/api/farmers`                    | sanctum+office|
| GET    | `/api/farmers/{id}`               | sanctum+office|
| PUT    | `/api/farmers/{id}`               | sanctum+office|
| DELETE | `/api/farmers/{id}`               | sanctum+office|

## Roles

`super_admin`, `admin`, `manager`, `accountant`, `operator`, `viewer`, `developer`.
Permissions are granular: `farmers.read`, `loans.approve`, `accounts.close_period`, …
See `database/seeders/RolesPermissionsSeeder.php`.

## What's NOT included yet (Phase 2)

- Loans / Savings / Irrigation / Payments / Accounts / Reports controllers
- Frontend rewrite (still Supabase)
- WebSockets (Soketi)
- Old Supabase / Prisma cleanup

## Schedules (auto, container `scheduler`)

- 07:30 daily — irrigation due reminders SMS
- 02:30 daily — integrity scan
- 01:00 daily — Postgres backup → MinIO
- 1st of month 02:00 — monthly reconciliation
