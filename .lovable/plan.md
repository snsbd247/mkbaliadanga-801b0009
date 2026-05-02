# Smart Irrigation & Cooperative Management System — MVP Plan

A production-style web app for cooperative-based irrigation and farmer management, with role-based access, bilingual UI (English/Bangla), and full accounting modules.

## Tech Stack
- React + Vite + TypeScript + Tailwind + shadcn/ui (already set up)
- **Lovable Cloud** (Supabase) for: Postgres database, Auth (email/password), Storage (farmer images), Row-Level Security, Edge Functions if needed
- React Router for routing, TanStack Query for data, react-hook-form + zod for forms
- jsPDF + xlsx for PDF/Excel exports
- i18n via lightweight context (English + Bangla)

## Roles & Security
- `app_role` enum: `super_admin`, `admin`, `staff`
- Separate `user_roles` table + `has_role()` security definer function (avoids RLS recursion)
- Each user linked to an `office_id` via a `profiles` table
- RLS policies: super_admin sees all; admin/staff scoped to their office; staff write-only on collections, no approvals

## Database Schema (high level)
```text
profiles (id → auth.users, full_name, office_id, language_pref)
user_roles (user_id, role)
offices (id, name, registration_no, established_on, contact, address)
seasons (id, year, type[Aman|Boro|Iri|Other], default_rate_config)
farmers (id, farmer_code "YYYY-00000001", name_en, name_bn, father, mother,
         nid, mobile, village, post, upazila, district, division, address,
         photo_url, office_id, status[active|inactive], created_by)
lands (id, farmer_id, mouza, dag_no, land_size, owner_type, field_type)
savings_transactions (id, farmer_id, type[deposit|withdraw], amount,
                      status[pending|approved|rejected], approved_by, txn_date)
shares (id, farmer_id, balance)
loans (id, farmer_id, principal, interest_enabled, interest_rate,
       total_payable, issued_on, next_due_on, status[pending|approved|paid])
loan_payments (id, loan_id, amount, paid_on)
irrigation_charges (id, farmer_id, land_id, season_id, basis[size|day|hour],
                    quantity, base_charge, canal_charge, maintenance_charge,
                    other_charge, total, paid_amount, due_amount, entry_date)
payments (id, farmer_id, kind[loan|savings|irrigation], reference_id,
          amount, method, collected_by, created_at)
audit_logs (id, user_id, action, entity, entity_id, meta, created_at)
```
- Auto farmer code via DB trigger using a per-year sequence
- Indexes on farmer_id, office_id, season_id, dates
- All tables RLS-enabled with office-scoped policies

## Modules / Pages
1. **Auth**: Login, password reset (Lovable Cloud auth)
2. **Layout**: Sidebar navigation + topbar with language toggle (EN/BN), user menu, office indicator
3. **Dashboard**: Summary cards (Total/Active Farmers, Savings, Shares, Loans, Irrigation Collection, Today's Collection, Total Due), Recent Transactions list, Pending Approvals list
4. **Offices** (super_admin only): CRUD
5. **Users & Roles** (super_admin/admin): invite users, assign role + office
6. **Farmers**: List with search/filter/pagination, Create/Edit form (bilingual fields, image upload), Detail page (tabs: Info, Lands, Savings, Loans, Irrigation, Full Report)
7. **Lands**: nested under farmer detail — add multiple lands
8. **Seasons**: CRUD, link default irrigation rates
9. **Savings**: Deposit form, Withdraw request, Approval queue, ledger per farmer, daily/monthly reports
10. **Loans**: Issue loan (with global default interest fallback + per-loan override), approval flow, collection page, status tracking, due highlighting
11. **Irrigation**: Entry per land/season with basis (size/day/hour), itemized charges with auto total, per-farmer/per-land due tracking
12. **Unified Payment**: Single screen → pick farmer → choose Loan/Savings/Irrigation → auto-update balances, write to `payments` + module-specific table
13. **Reports**: Farmer-wise full report (printable), Irrigation report (season/land), Loan report, Savings report. Filters: date range, office, farmer. Export PDF + Excel.
14. **Notifications** (in-app): badge for pending withdrawals & loan approvals
15. **Audit Logs** (super_admin): table view

## Bilingual Support
- `LanguageProvider` context, translations dictionary (`en` / `bn`)
- Toggle in topbar, persisted to profile
- Farmer fields stored bilingually (name_en, name_bn) and rendered per active language

## Design System
- Professional cooperative/agriculture feel: deep green primary, gold accent, neutral surfaces
- HSL semantic tokens in `index.css` + tailwind extensions; no hard-coded colors in components
- Dues highlighted with destructive token; status badges with semantic variants
- Card-based dashboard, clean tables with shadcn DataTable patterns

## Implementation Order
1. Enable Lovable Cloud, set up auth, schema, RLS, seed data
2. Design system + sidebar layout + i18n + auth pages
3. Offices, Users, Farmers, Lands
4. Seasons, Irrigation
5. Savings, Loans
6. Unified Payments
7. Dashboard wiring
8. Reports + PDF/Excel export
9. Notifications, audit logs, polish

## Scope Notes (MVP)
- Email/password auth only (no Google for now — can add later)
- Audit logs: basic write-on-mutation, viewable list
- Reports: clean printable HTML + jsPDF; Excel via SheetJS
- Realistic seed data for ~20 farmers, 2 offices, 2 seasons

## Confirmation Needed
This is a large build (~30–50 files, schema + many UI screens). I'll execute it in the order above, committing working slices. Approve to proceed and I'll start by enabling Lovable Cloud and laying down the schema + design system.
