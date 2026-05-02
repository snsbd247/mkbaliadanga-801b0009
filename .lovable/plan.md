## SMS Provider Hardening Plan

Five related improvements to GreenWeb SMS configuration. Two are partially built and will be polished; three are new.

---

### 1. Token rotation with staging + expiry (NEW)

Extend `sms_provider_secrets` so multiple tokens can coexist per provider with a clear lifecycle:

```text
provider | api_token | status   | expires_at | activated_at | updated_by
greenweb | tok_xxx   | active   | 2026-08-01 | 2026-05-02   | <uuid>
greenweb | tok_yyy   | staged   | 2026-11-01 | NULL         | <uuid>
greenweb | tok_zzz   | retired  | -          | -            | <uuid>
```

- Schema change: drop the `provider`-only PK, add `id uuid PK`, columns `status` (`active|staged|retired`), `expires_at timestamptz nullable`, `activated_at timestamptz nullable`, `label text nullable`. Partial unique index ensures **only one `active` row per provider**.
- Save flow: new tokens always land as **`staged` + disabled** (per your choice). A separate **"Activate"** action atomically retires the current `active` row and promotes the staged one — zero downtime, instant rollback by re-activating the retired row before it's deleted.
- `getGreenWebToken()` in the edge function selects the single `active` row; if none active or `expires_at < now()`, send fails with a clear "token expired/not active" error.
- UI shows a token list (status badge, expiry, last updated, who) with **Activate / Retire / Delete** buttons.

### 2. Audit log for SMS secret changes (NEW)

Database trigger `trg_audit_sms_provider_secrets` on INSERT/UPDATE/DELETE writes to existing `public.audit_logs`:

- `action`: `sms_secret.create | sms_secret.update | sms_secret.activate | sms_secret.retire | sms_secret.delete`
- `entity`: `sms_provider_secrets`, `entity_id`: row id
- `meta`: `{ provider, status_before, status_after, expires_at, label, masked_token: "tok_****abcd" }`
- `user_id`: from `auth.uid()`; never stores raw token.

Settings page gets a **"Recent token changes"** panel reading the last 20 entries (super-admin RLS already covers this).

### 3. Token format validation (NEW)

Per your choice: **alphanumeric, 20–80 chars** (`/^[A-Za-z0-9]{20,80}$/`).

- **Client (zod)** in `SmsSettings.tsx` save handler — rejects with inline error before any network call.
- **Server (zod)** in `send-sms` edge function on the save path is N/A (saves go direct to DB), so we add a **Postgres CHECK constraint** plus a `BEFORE INSERT/UPDATE` trigger that raises a friendly error: `"GreenWeb token must be 20–80 alphanumeric characters"`. This guarantees rejection even if someone bypasses the UI.

### 4. Dashboard SMS status indicator (NEW)

New compact card on `src/pages/Dashboard.tsx` (super-admin & admin only), showing:

- **Status pill**: `Ready` (green) / `Disabled` (gray) / `No token` (red) / `Expiring in N days` (amber, < 14 days) / `Expired` (red).
- Last updated timestamp + updater name.
- Sender ID.
- Click → navigates to `/settings/sms`.

Reads from a small RPC `get_sms_provider_status()` (security definer, returns no token bytes) so we don't expose the secret table to non-super-admins.

### 5. "Send test SMS" button (POLISH — already exists)

`runTestConnection` in `SmsSettings.tsx` and `test_connection` mode in `send-sms` are already implemented. Polish work:

- Make the test path read the **active** token (works automatically after step 1).
- Add a confirmation dialog ("This sends ~1 paid SMS").
- Persist last test result (timestamp, status, masked response) into `sms_settings.config.last_test` so the dashboard card and Settings page both show "Last successful test: …".

---

### Technical Details

**Migration outline**

```sql
-- 1. Restructure sms_provider_secrets
ALTER TABLE public.sms_provider_secrets
  DROP CONSTRAINT sms_provider_secrets_pkey,
  ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ADD COLUMN status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('active','staged','retired')),
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN label text;

CREATE UNIQUE INDEX one_active_token_per_provider
  ON public.sms_provider_secrets(provider) WHERE status = 'active';

-- 2. Format constraint + friendly trigger
ALTER TABLE public.sms_provider_secrets
  ADD CONSTRAINT api_token_format
  CHECK (api_token ~ '^[A-Za-z0-9]{20,80}$');

-- 3. Audit trigger writing to public.audit_logs with masked token
CREATE TRIGGER trg_audit_sms_provider_secrets
  AFTER INSERT OR UPDATE OR DELETE ON public.sms_provider_secrets
  FOR EACH ROW EXECUTE FUNCTION audit_sms_provider_secrets();

-- 4. Activation RPC (atomic swap)
CREATE FUNCTION activate_sms_token(_id uuid) RETURNS void ...
  -- super-admin only; sets current active -> retired, given id -> active

-- 5. Status RPC for dashboard (no token bytes)
CREATE FUNCTION get_sms_provider_status() RETURNS jsonb ...
  -- returns { configured, status, expires_at, days_to_expiry, sender_id, last_updated, last_updater_name, last_test }
```

**Code touchpoints**

- `supabase/functions/send-sms/index.ts` — `getGreenWebToken()` filters `status='active' AND (expires_at IS NULL OR expires_at > now())`.
- `src/pages/SmsSettings.tsx` — replace single-token UI with token list + Activate/Retire actions; add zod validation; add audit log panel; add expiry date picker on save.
- `src/pages/Dashboard.tsx` — add `SmsProviderStatusCard` component calling `get_sms_provider_status` RPC.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

**Backward compatibility**

The migration backfills the existing single row (if any) as `status='active'` with `activated_at = updated_at`, so live SMS keeps working through the upgrade.

---

### Out of scope

- Multiple SMS providers (GreenWeb only for now).
- Auto-rotation on a schedule (manual activation per your choice).
- Email/Slack alerts on expiry (dashboard pill only).
