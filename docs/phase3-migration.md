# Phase 3 — Frontend Laravel API Migration

## What's added (Phase 3.1: Auth + Farmers)

A **parallel** API layer that talks to the Laravel backend (in `backend/`), without breaking the existing Supabase-powered app.

### New files

| File | Purpose |
|---|---|
| `src/lib/api/client.ts` | Axios instance, token storage, 401 handler |
| `src/lib/api/auth.ts` | `login`, `me`, `logout`, password reset |
| `src/lib/api/farmers.ts` | Farmer CRUD endpoints |
| `src/auth/LaravelAuthProvider.tsx` | New context provider (parallel to Supabase `AuthProvider`) |
| `src/hooks/useFarmersApi.ts` | React Query hooks for farmer CRUD |
| `src/pages/ApiAuth.tsx` | New login page → `/api/auth` |
| `src/pages/ApiFarmers.tsx` | New farmers page → `/api/farmers` |

### Try it

1. Start Laravel backend (`cd backend && docker compose up -d`)
2. Set `VITE_API_URL` in `.env` (e.g. `http://localhost:8080/api` or `https://api.mohammadkhani.com/api`)
3. Open `/api/auth` in the app → login → redirect to `/api/farmers`

### Token storage

JWT bearer token stored in `localStorage` under `mkb_api_token`. 401 responses auto-clear and dispatch `api:unauthorized`.

### Next phases

- 3.2 — Loans + Payments + Savings
- 3.3 — Reports + Accounting
- 3.4 — Replace `AuthProvider` with `LaravelAuthProvider` globally + remove Supabase
