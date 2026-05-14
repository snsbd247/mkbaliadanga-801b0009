# Frontend Deployment — Lovable Preview vs VPS

The frontend now auto-detects which backend to use at build time.

## Lovable Preview (default)

No env vars needed. The app uses the existing Supabase-powered routes
(legacy `/auth`, `/`, `/dashboard`, etc.) so everything keeps working
inside the Lovable sandbox.

- `BACKEND_MODE` resolves to `supabase`
- `USE_API_BACKEND` is `false`
- `/api/auth` redirects → `/auth`
- `/api/farmer-login` redirects → `/`

## VPS Build (Laravel backend)

Set these before running `npm run build` on the VPS:

```bash
# Required: points the SPA at the Laravel API
export VITE_API_URL="https://api.your-domain.com/api"

# Optional overrides
export VITE_BACKEND="laravel"   # force Laravel mode (auto-detected from VITE_API_URL anyway)
export VITE_USE_API="1"         # force API routes as primary (default when Laravel mode)
```

Then:

```bash
npm ci
npm run build
# upload dist/ to nginx web root
```

On the VPS the app will:
- Hit Laravel for auth, data, RBAC, etc.
- Use the new login pages: `/api/auth` (User ID + Password) and
  `/api/farmer-login` (Farmer ID + Mobile).

## Force a mode (escape hatch)

| Goal | Env vars |
|------|----------|
| Force Supabase even on VPS (rollback) | `VITE_BACKEND=supabase VITE_USE_API=0` |
| Force Laravel even in Lovable preview | `VITE_BACKEND=laravel VITE_API_URL=https://...` |

## Backend (Laravel) on the VPS

After deploying the backend code:

```bash
cd backend
php artisan migrate
php artisan db:seed --class=AdminUserSeeder
```

This creates:
- `ismail162 / 123456` — developer + super_admin
- `superadmin / Admin@123456` — super_admin
