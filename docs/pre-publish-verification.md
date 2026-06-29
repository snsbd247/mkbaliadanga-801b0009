# Pre-Publish Verification Checklist

Run before every production publish. Auto-checks via `scripts/rls-audit.sql` + the queries below.

## 1. Office-scoped RLS (data isolation)

| Check | Query | Expected | Status |
|---|---|---|---|
| No office table with RLS disabled | tables with `office_id` and `relrowsecurity=false` | empty | ✅ pass |
| No public table without policies | RLS-on tables with zero policies | empty | ✅ pass |
| No cross-office `SELECT USING(true)` on sensitive tables | office tables with `qual='true'` | only shared catalogs | ⚠️ see note |

**Note — remaining `USING(true)` SELECT policies are intentional shared/reference data:**
`receipt_sequences`, `sms_office_settings`, `irrigation_season_types`, `land_types` — read-only catalogs/config, not member financial data. Writes remain office/role gated.

**Fixed this round (member-sensitive):**
- `hand_cash_submissions` — read now `super_admin OR office_id = current_user_office()`.
- `loan_discount_audit` — read now `super_admin OR office_id = current_user_office()`.

## 2. Storage buckets (file isolation)

| Bucket | Read | Delete | Status |
|---|---|---|---|
| `farmer-photos` | office-scoped (`farmers.office_id`) | office-scoped + admin | ✅ blanket-delete removed |
| `land-note-attachments` | office-scoped (`land_note_attachments.office_id`) | office-scoped + super | ✅ open read/delete removed |

Both buckets are **private** (`public=false`).

## 3. Audit logging (add / edit / approval / export)

Searchable in **Admin → Audit Timeline** by module + date range; RLS scopes rows to the
viewer's office (super admins see all).

| Action | Source | Logged |
|---|---|---|
| Payment create/edit/cancel | `Payments.tsx`, `IrrigationPaymentPanel.tsx` | ✅ |
| Approvals (single + bulk approve/reject) | `Approvals.tsx` | ✅ added |
| Report/data exports | report pages via `auditExport()` | ✅ added |
| Barga split / allocation | `irrigationBargaAudit.ts` | ✅ |

`system_audit_logs` SELECT: `super_admin OR office_id = current_user_office()` — office + date searchable.

## 4. Auth & edge functions

- Email/password + Google auth; no anonymous sign-ups.
- All Lovable-managed edge functions validate JWT in code (deployed `verify_jwt=false` by design).
- Roles stored in `user_roles` (never on profiles); access via `has_role()` security-definer.
- Service-role key / DB password never exposed to client.

## How to re-run

```bash
psql -f scripts/rls-audit.sql
# plus the four spot-checks in section 1 & 2 of this doc
```
Then run the Supabase linter and confirm no NEW critical findings vs. baseline
(pre-existing: security-definer views, extensions-in-public — tracked separately).
