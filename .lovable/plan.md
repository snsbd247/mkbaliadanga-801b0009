# Plan: CRUD audit + Membership Card + QR Scan Payment

Scope is locked by your answers: **audit-then-fill** for CRUD, **add new routes only**, **tabs only** for farmer portal, **opaque token** for QR.

## 1. CRUD audit (fill gaps only — no churn on working pages)

I will read each list page and report what is missing. Likely findings (to confirm by reading the files, not assumed):

| Module | View | Edit | Delete |
|---|---|---|---|
| Farmers (`/farmers` + `/farmers/:id`) | exists | likely exists | check |
| Loans (`/loans`) | tbd | tbd | tbd |
| Savings (`/savings`) | tbd | tbd | tbd |
| Ledger Entries (`/ledger`) | tbd | tbd | tbd (super-admin only by RLS) |

For any genuine gap I'll add: a confirm-delete dialog (using existing `AlertDialog`), an inline edit dialog reusing the same form as create, and a view dialog for read-only details. No soft-delete column exists today on these tables, so delete = hard delete (matches current behavior). Existing RLS already enforces who can edit/delete.

## 2. Membership Card system

**New route** `/farmers/:id/card` (under existing `AppLayout`, so it inherits auth + sidebar). I'm using `/farmers/...` not `/admin/farmer/...` to match the rest of the admin routes you already have — keeps URLs consistent.

**Card layout** (CR80, 85.6 × 54 mm, both sides on one printable A4 sheet):

```
┌──────────────── FRONT ────────────────┐  ┌──────────────── BACK ─────────────────┐
│ [logo]   COMPANY NAME (bn / en)        │  │  Address: village, union, upazila…    │
│                                        │  │  Mobile:  017xx-xxxxxx                │
│              ┌────────┐                │  │                                       │
│              │ photo  │   Name         │  │              ┌──────────┐             │
│              └────────┘   ID:  …       │  │              │   QR     │             │
│                           Member: M-…  │  │              └──────────┘             │
│                           Issued: …    │  │  Scan to pay • do not share          │
└────────────────────────────────────────┘  └────────────────────────────────────────┘
```

**Export**:
- Print-friendly view via a dedicated print stylesheet (`@page { size: 90mm 56mm; }` and `@media print` to hide chrome).
- PDF via existing `jspdf` (already in deps) — render at exact mm dimensions, embed photo + QR as data URLs.

**QR contents**: just the opaque token string (e.g. `mkc_<32 hex>`). No URL, no PII.

## 3. QR token table + edge function

New table `qr_tokens`:

- `farmer_id uuid not null`
- `token text not null unique` (32-byte hex, prefixed `mkc_`)
- `revoked boolean default false`
- `created_at timestamptz default now()`
- `created_by uuid`

RLS: deny-all to client; only edge functions (service role) read/write. Card page calls a new edge function `farmer-card-token` that returns the current token for a farmer (creates one if none, rotates if `?rotate=1`).

Scan endpoint: `qr-resolve-token` — takes `{ token }`, returns `{ farmer: {id, name, mobile_masked, dues}}`. Validates token, checks not revoked, logs lookup to `audit_logs`.

## 4. QR Scan Payment flow

**New route** `/scan-payment` (admin/staff) under `AppLayout`.

Flow:
1. Page opens camera using existing `html5-qrcode` (already in deps — same lib used by `/scan`).
2. On scan → POST token to `qr-resolve-token` → receive farmer summary.
3. Render a small "Collect payment" form (reuse the same insert path as the existing Payments page). Fields: amount (>0), kind (loan / savings / irrigation / other), note.
4. Submit → INSERT into `payments` (existing table, existing triggers handle ledger + SMS automatically). Server-side validation: amount > 0, farmer exists, token valid.
5. Show success toast + receipt link.

No new payments logic — reuses the existing `payments` table and its triggers, which already post to ledger and trigger SMS. So we don't risk breaking accounting.

## 5. Routes added

New, additive only — nothing existing moves:

- `/farmers/:id/card` — Membership Card view (admin/staff)
- `/scan-payment` — QR scanner + payment form (admin/staff)

## 6. Security

- QR carries an opaque token, never raw farmer UUID.
- `qr_tokens` table has RLS deny-all; only service-role edge functions touch it.
- Scan + card endpoints require an authenticated admin/staff session (verified via `getClaims` with the user's JWT).
- `audit_logs` row written on token issue, scan, and payment collection.
- Inputs validated with Zod in both edge functions.

## 7. Files I'll change / add

**New**:
- `supabase/migrations/<ts>_qr_tokens.sql` — table + RLS
- `supabase/functions/farmer-card-token/index.ts`
- `supabase/functions/qr-resolve-token/index.ts`
- `src/pages/FarmerCard.tsx`
- `src/pages/ScanPayment.tsx`
- `src/components/card/MembershipCard.tsx` (the printable card itself)
- `src/components/card/cardPdf.ts` (jsPDF export)

**Edited**:
- `src/App.tsx` — register the two new routes
- `src/pages/Farmers.tsx` / `FarmerDetail.tsx` — add a "Print Card" button (only if missing)
- `src/components/layout/AppSidebar.tsx` — add a "Scan Payment" link
- `supabase/config.toml` — register the two new functions with `verify_jwt = false` (we validate in code so we can return clean JSON 401s)

CRUD gap-fills are listed only after I read each page and confirm what's actually missing — I won't touch a page that already has working View/Edit/Delete.

## What this plan deliberately does NOT do

- No move of existing routes under `/admin/*` (you chose "add new routes only").
- No new `/farmer/ledger`, `/farmer/loan`, `/farmer/savings` pages (you chose "tabs only").
- No soft-delete migration on existing tables — they don't have one today, adding it would be a schema change with cascade implications.
- No rate limiting on the new endpoints (per project guidance — backend rate-limiting primitives aren't in place; the existing OTP throttling pattern can be added later if desired).

After approval I'll execute in this order: migration → edge functions → card UI → scan UI → CRUD audit + gap fixes → tests.
