## Overview

Five separate admin/UX improvements, each shipped in its own scoped change. None requires schema changes — we reuse the existing `user_permissions`, `profiles.office_id`, and `LanguageProvider`.

---

### 1. Non-destructive Demo Reset (with preview)

**New page**: `src/pages/admin/DemoReset.tsx` (Super Admin only)

- On load, fetch live counts (preview) for tables that will be wiped: `farmers`, `lands`, `loans`, `loan_payments`, `payments`, `savings_transactions`, `irrigation_charges`, `expenses`, `ledger_entries`, `journal_entries`, `payment_allocations`, `receipts`, `notifications`, `audit_logs`.
- Show a table: *Table | Current rows | After reset (demo count)*.
- "Reset to demo data" button → confirmation dialog requiring typing `RESET` → calls a new edge function `demo-reset` that runs the same wipe + reseed SQL we used previously, behind a `super_admin` guard.
- Preserves: locations, offices, accounts, roles, profiles, settings.
- Route: `/admin/demo-reset`. Sidebar link under Admin.

**Edge function**: `supabase/functions/demo-reset/index.ts` — verifies caller is `super_admin`, then runs the wipe+seed via service role.

---

### 2. Bangla/English verification + login language toggle

- Audit `src/i18n/translations.ts` and add any missing keys used in nav and forms (sidebar items, common form labels).
- `Auth.tsx` already imports `useLang` — add a visible **EN / বাংলা** toggle button at the top of the login card (same component as `FarmerPortalLogin`).
- Add the same toggle to `FarmerPortalLogin` and `ResetPassword`.
- Add a small `<LanguageToggle />` shared component in `src/components/LanguageToggle.tsx`.

---

### 3. Role-Permission Matrix screen

**New page**: `src/pages/admin/RoleMatrix.tsx` (Super Admin only).

- Grid: rows = `ALL_MODULES`, columns = roles (Super Admin / Admin / Staff) × actions (View/Add/Edit/Delete).
- Super Admin row is locked (always full).
- Edits update a new `role_permissions` table (one row per role+module). On save, the existing `usePermissions` hook falls back to these role defaults instead of the hardcoded `staffDefaults` map.

**Migration**: create `public.role_permissions (role app_role, module text, can_view, can_add, can_edit, can_delete, PK(role,module))` with RLS — read by all authenticated, write by super_admin only. Seed with current staff/admin defaults.

**Code update**: `src/lib/permissions.ts` — load role_permissions once and use them as the fallback before the hardcoded map.

Route: `/admin/role-matrix`. Sidebar link under Admin.

---

### 4. Office assignment UI + login verification

- **Users page enhancement**: the create form already has `office_id`; add an inline "Office" dropdown directly in the user list row (not just in dialog) so admins can reassign quickly. Save updates `profiles.office_id` via the existing `admin-users` edge function (add an `update_office` action if missing).
- **Login verification**: in `AuthProvider.loadProfile`, after roles+office load, if user has `admin` or `staff` role but `office_id` is null, surface a toast on the dashboard ("No office assigned — contact a super admin"). Block writes by relying on existing RLS, but show a clear banner on `Dashboard.tsx`.

---

### 5. Admin login always lands on Admin dashboard

Currently `/` is `FarmerPortalLogin`. After admin signs in via `/auth`, `Auth.tsx` already navigates to `/admin`. The issue is users hitting `/` while already logged in as admin still see the farmer portal.

- In `FarmerPortalLogin`, on mount check `useAuth()`: if `user` exists AND has any admin role (`isAdmin || isCommittee || isSuper`), redirect to `/admin`.
- In `AppLayout`, if user has no admin role at all (pure farmer), redirect to `/`.
- Add a small "Admin Login" link on the farmer portal page → `/auth` (probably already there, verify).

---

## Technical details

- **Files added**: `src/pages/admin/DemoReset.tsx`, `src/pages/admin/RoleMatrix.tsx`, `src/components/LanguageToggle.tsx`, `supabase/functions/demo-reset/index.ts`.
- **Files edited**: `src/App.tsx` (routes), `src/components/layout/AppSidebar.tsx` (links), `src/pages/Auth.tsx` + `FarmerPortalLogin.tsx` + `ResetPassword.tsx` (language toggle), `src/auth/AuthProvider.tsx` (no-office warning state), `src/lib/permissions.ts` (role_permissions fallback), `src/pages/Users.tsx` (inline office dropdown), `src/pages/Dashboard.tsx` (banner), `src/i18n/translations.ts` (missing keys).
- **DB migration**: add `role_permissions` table + RLS + seed.

## Order of execution

1. Migration (role_permissions)
2. Edge function (demo-reset)
3. Shared `LanguageToggle` component
4. New pages (DemoReset, RoleMatrix)
5. Wire routes + sidebar
6. Auth flow tweaks (FarmerPortalLogin redirect, office warning banner)
7. Users page inline office dropdown
8. Translations top-up
