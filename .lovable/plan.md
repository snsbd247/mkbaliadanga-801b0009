# Voter Audit + Role-Update RLS Fix

## 1. user_roles RLS fix (migration)

Current policy only allows `super_admin` to manage roles, so admins editing users get RLS errors. Replace with:

- `super admin manage roles` (ALL) — full access
- `admin update office roles` (UPDATE) — `is_admin_or_super(auth.uid())` AND target user's `profiles.office_id = current_user_office()` AND `role <> 'super_admin'` (in both USING and WITH CHECK)
- `admin insert office roles` (INSERT) — same check on inserted row's user
- `admin delete office roles` (DELETE) — same office scoping, never super_admin
- Existing `users read own roles` SELECT policy kept unchanged

Also add a `prevent_super_admin_self_demotion` trigger: on DELETE/UPDATE of the last super_admin row by the same user, raise an exception.

`Users.setRole()` is left as-is (delete + insert) since policies cover both ops.

## 2. voter_audit_logs table + trigger

```text
voter_audit_logs
  id uuid pk
  farmer_id uuid not null
  account_number text
  voter_number_old text
  voter_number_new text
  is_voter_old boolean
  is_voter_new boolean
  changed_by uuid
  office_id uuid
  created_at timestamptz default now()
```

Trigger `trg_voter_audit` on `farmers` AFTER UPDATE — fires only when `voter_number` or `is_voter` changes.

RLS:
- `office read voter_audit` (SELECT): super_admin OR same office
- INSERT only via trigger (security definer); no client INSERT/UPDATE/DELETE policies

The pre-existing `audit_logs`-based voter trigger from the earlier loop is replaced by this dedicated table (cleaner queries, faster filters).

## 3. Viewer page `/voter-audit`

New page `src/pages/VoterAudit.tsx`, route added in `App.tsx`, sidebar link under Reports (admin+ only).

Filters:
- Farmer search (reuses `FarmerSearchSelect`)
- Office (super admin only; admin auto-scoped)
- Date range (from/to)

Table columns: Date · Farmer (name + account) · Old → New voter # · Changed by (profile name) · Office.

Pagination: 50/page.

## 4. Export

"Export Excel" + "Export PDF" buttons on the viewer using existing `exportExcel` / `exportTablePDF` from `src/lib/exports.ts` against the currently filtered rows.

## 5. History modal on Farmers page

Add a small "History" icon button next to the existing `VoterToggleField` in `Farmers.tsx`. Opens a Dialog showing the last 20 audit rows for that farmer (same columns as viewer, no filters).

## 6. Voter toggle UX

`VoterToggleField` already uses an in-flight loader. Tighten it:
- On RPC error: revert `is_voter` toggle locally, keep prior `voter_number`, show inline `Alert` under the toggle (not just toast)
- Disable toggle while pending
- Surface RLS / network error message verbatim

## 7. Tests

- `src/lib/__tests__/voterAudit.policy.test.ts` — mocked supabase client asserting:
  - super admin: insert/update/delete user_roles allowed
  - admin same office: update allowed, super_admin role rejected
  - staff: denied
- `src/lib/__tests__/voterAudit.trigger.test.ts` — asserts a voter_number change produces a `voter_audit_logs` row with correct old/new values (uses mocked client)

These are unit-level mock tests (no live DB) consistent with the existing `__tests__` pattern.

## Files

Created:
- `supabase/migrations/<ts>_voter_audit_and_role_rls.sql`
- `src/pages/VoterAudit.tsx`
- `src/lib/__tests__/voterAudit.policy.test.ts`
- `src/lib/__tests__/voterAudit.trigger.test.ts`

Edited:
- `src/App.tsx` (route)
- `src/components/layout/AppSidebar.tsx` (link)
- `src/pages/Farmers.tsx` (History modal + tighter VoterToggleField)

Untouched: ledger, payments, reports, auth provider, farmer CRUD payload.

## Non-breaking guarantees

- Existing `super admin manage roles` policy preserved → no regression for super admin flows.
- Voter trigger is additive; old `audit_logs` voter trigger is dropped to avoid double-logging.
- No changes to farmer columns, RPC signatures, or client APIs used elsewhere.
