# Reliability, Retry, Audit & Permission Matrix — Rollout Plan

This is 5 large epics. Shipping all at once would be risky — proposing a phased rollout that leaves the app working after every phase. Each phase is one chat message.

---

## Phase 1 — Retry Queue + SMS/Receipt Status (foundation)

**DB migration**

- `background_retry_jobs` table: `id, office_id, job_type, reference_id, payload jsonb, status, retry_count, max_retry, next_retry_at, last_error, created_at, updated_at` + RLS (office-scoped read, super-admin manage, system insert via edge function).
- Extend `irrigation_sms_logs.status` allowed values: `pending|sent|delivered|failed|retrying|permanently_failed`.
- New `receipt_jobs` table (or reuse `background_retry_jobs` with `job_type='receipt_generation'`) — go with the latter to keep one queue.
- Status enum constraint via trigger (no CHECK with non-immutable funcs).

**Code**

- `src/lib/retryQueue.ts` — `enqueue(jobType, refId, payload)`, `markSuccess`, `markFailed` (computes next_retry_at via 1m / 5m / 15m / 1h schedule).
- Wrap SMS + receipt calls in `IrrigationPaymentPanel` so payment is never rolled back on SMS/PDF failure — failures enqueue retry job.
- Edge function `process-retry-jobs` (cron-eligible) — picks `next_retry_at <= now()`, dispatches by `job_type`, updates status; transitions to `permanently_failed` after `max_retry`.
- Admin notification: surface failed jobs in existing notifications panel + dashboard alert card.
- Manual actions: "Retry" / "Regenerate Receipt" / "View failure" buttons on failed-jobs admin page (`/admin/retry-jobs`).

**Tests**

- Unit: schedule computation (`nextRetryAt(attempt)`).
- Integration: enqueue → process → success / exhaust path.

---

## Phase 2 — Centralized Audit Log (`system_audit_logs`)

**DB migration**

- `system_audit_logs(id, office_id, user_id, module, action_type, reference_id, old_data jsonb, new_data jsonb, ip, user_agent, created_at)` — insert-only (no UPDATE/DELETE policy).
- RLS: office-scoped read + super-admin all; INSERT via authenticated.

**Code**

- `src/lib/audit.ts` — `logAudit({ module, action, refId, before, after })`. Used everywhere financial actions occur.
- Wire into: payment create/edit/cancel/retry, receipt generated/regenerated/failed/downloaded, SMS sent/failed/retried, journal posted/reversed/corrected.
- Admin page `/admin/audit-timeline` — search, filter by module/user/date, timeline view, CSV export.

**Tests**

- Unit: `logAudit` payload shape.
- Integration: payment flow writes 4+ audit rows.

---

## Phase 3 — CSV Export (Promise Due + Mismatch)

- Add `Export CSV` button (UTF-8 BOM for Bangla) to `PromiseDueReport.tsx` and `IrrigationDueMismatch.tsx`.
- Respect active filters; stream rows in chunks of 5k for large datasets.
- Columns exactly per spec.

**Tests**

- Unit: CSV escaping + Bangla UTF-8 round-trip.

---

## Phase 4 — Role Permission Matrix UI

**DB migration**

- `role_permissions(id, role app_role, module text, action text, allowed boolean, office_id uuid null, updated_by, updated_at)` — unique `(role, module, action, office_id)`.
- `permission_audit_logs(id, role, module, action, old_value, new_value, office_id, changed_by, created_at)`.
- Helper SQL fn `has_permission(_user, _module, _action) returns boolean` (security definer).
- Seed sensible defaults from current hardcoded role checks.

**Code**

- Page `/admin/permissions` (route + sidebar entry "রোল ও অনুমতি ম্যাট্রিক্স").
- Matrix table: rows = module × action; columns = roles. Inline toggle, bulk select, role cloning, search, sticky headers, Bangla labels.
- Guards: super-admin only; can't toggle off own role's "manage permissions"; confirm dialog for destructive toggles; every change writes `permission_audit_logs` + `system_audit_logs`.
- Optional `usePermission(module, action)` hook used by sensitive UI buttons (gradual adoption — does NOT replace existing RLS / role checks).

**Tests**

- Unit: privilege escalation guard.
- Integration: toggle persists + audit row.

---

## Phase 5 — E2E Tests (Playwright)

- Add Playwright + seed script + `npm run test:e2e`, `npm run test:irrigation`.
- Scenarios: invoice payment, promise-date flow, delay-fee override, receipt failure recovery, SMS failure recovery, duplicate prevention.
- Failure screenshots, retry logs, JUnit report, optional GH Actions nightly job.

---

## Out of scope / kept compatible

- Existing accounting, ledger, receipt verify, SMS gateway, RLS, role checks, reports — untouched. New audit/permission systems are additive.
- `irrigation_charges` legacy reads remain in audit/legacy pages (per previous phase).

---

## Suggested order

Ship Phase 1 next (highest value, unblocks reliability). Then 2 → 3 → 4 → 5.

Reply **"ok phase 1"** (or specify a different phase) to proceed.
