-- 1. New columns
ALTER TABLE public.sms_provider_secrets
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'staged',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS label text;

-- 2. PK swap: drop existing pk, add pk on id
ALTER TABLE public.sms_provider_secrets DROP CONSTRAINT IF EXISTS sms_provider_secrets_pkey;
ALTER TABLE public.sms_provider_secrets ADD PRIMARY KEY (id);

-- 3. Backfill: pre-existing rows become active
UPDATE public.sms_provider_secrets
   SET status = 'active',
       activated_at = COALESCE(activated_at, updated_at, now())
 WHERE provider = 'greenweb';

-- 4. Status check
ALTER TABLE public.sms_provider_secrets
  DROP CONSTRAINT IF EXISTS sms_provider_secrets_status_check;
ALTER TABLE public.sms_provider_secrets
  ADD CONSTRAINT sms_provider_secrets_status_check
  CHECK (status IN ('active','staged','retired'));

-- 5. Only one active token per provider
DROP INDEX IF EXISTS public.one_active_sms_token_per_provider;
CREATE UNIQUE INDEX one_active_sms_token_per_provider
  ON public.sms_provider_secrets(provider) WHERE status = 'active';

-- 6. Format constraint (alphanumeric 20-80)
ALTER TABLE public.sms_provider_secrets
  DROP CONSTRAINT IF EXISTS sms_provider_secrets_token_format;
ALTER TABLE public.sms_provider_secrets
  ADD CONSTRAINT sms_provider_secrets_token_format
  CHECK (api_token ~ '^[A-Za-z0-9]{20,80}$');

-- 7. Friendly error trigger
CREATE OR REPLACE FUNCTION public.validate_sms_provider_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.api_token IS NULL OR NEW.api_token !~ '^[A-Za-z0-9]{20,80}$' THEN
    RAISE EXCEPTION 'Invalid SMS API token format. Must be 20-80 alphanumeric characters (A-Z, a-z, 0-9).'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_sms_provider_token ON public.sms_provider_secrets;
CREATE TRIGGER trg_validate_sms_provider_token
  BEFORE INSERT OR UPDATE OF api_token ON public.sms_provider_secrets
  FOR EACH ROW EXECUTE FUNCTION public.validate_sms_provider_token();

-- 8. Audit trigger
CREATE OR REPLACE FUNCTION public.audit_sms_provider_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action text; v_meta jsonb; v_id uuid; v_mask text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'sms_secret.create';
    v_id := NEW.id;
    v_mask := CASE WHEN length(NEW.api_token) >= 4
                   THEN repeat('*', greatest(length(NEW.api_token)-4,4)) || right(NEW.api_token,4)
                   ELSE '****' END;
    v_meta := jsonb_build_object(
      'provider', NEW.provider, 'status', NEW.status,
      'expires_at', NEW.expires_at, 'label', NEW.label, 'masked_token', v_mask);
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := NEW.id;
    IF OLD.status <> NEW.status AND NEW.status = 'active' THEN v_action := 'sms_secret.activate';
    ELSIF OLD.status <> NEW.status AND NEW.status = 'retired' THEN v_action := 'sms_secret.retire';
    ELSE v_action := 'sms_secret.update'; END IF;
    v_mask := CASE WHEN length(NEW.api_token) >= 4
                   THEN repeat('*', greatest(length(NEW.api_token)-4,4)) || right(NEW.api_token,4)
                   ELSE '****' END;
    v_meta := jsonb_build_object(
      'provider', NEW.provider, 'status_before', OLD.status, 'status_after', NEW.status,
      'expires_at', NEW.expires_at, 'label', NEW.label, 'masked_token', v_mask,
      'token_changed', OLD.api_token IS DISTINCT FROM NEW.api_token);
  ELSE
    v_action := 'sms_secret.delete';
    v_id := OLD.id;
    v_mask := CASE WHEN length(OLD.api_token) >= 4
                   THEN repeat('*', greatest(length(OLD.api_token)-4,4)) || right(OLD.api_token,4)
                   ELSE '****' END;
    v_meta := jsonb_build_object(
      'provider', OLD.provider, 'status', OLD.status, 'masked_token', v_mask, 'label', OLD.label);
  END IF;

  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, meta)
  VALUES (auth.uid(), v_action, 'sms_provider_secrets', v_id, v_meta);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

DROP TRIGGER IF EXISTS trg_audit_sms_provider_secrets ON public.sms_provider_secrets;
CREATE TRIGGER trg_audit_sms_provider_secrets
  AFTER INSERT OR UPDATE OR DELETE ON public.sms_provider_secrets
  FOR EACH ROW EXECUTE FUNCTION public.audit_sms_provider_secrets();

-- 9. Activation RPC
CREATE OR REPLACE FUNCTION public.activate_sms_token(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_provider text; v_status text; v_expires timestamptz;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can activate SMS tokens';
  END IF;
  SELECT provider, status, expires_at INTO v_provider, v_status, v_expires
    FROM public.sms_provider_secrets WHERE id = _id;
  IF v_provider IS NULL THEN RAISE EXCEPTION 'Token not found'; END IF;
  IF v_status = 'retired' THEN RAISE EXCEPTION 'Cannot activate a retired token. Save a new one instead.'; END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RAISE EXCEPTION 'Cannot activate an expired token'; END IF;

  UPDATE public.sms_provider_secrets
     SET status='retired', updated_at=now(), updated_by=auth.uid()
   WHERE provider=v_provider AND status='active' AND id <> _id;

  UPDATE public.sms_provider_secrets
     SET status='active', activated_at=now(), updated_at=now(), updated_by=auth.uid()
   WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.retire_sms_token(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can retire SMS tokens';
  END IF;
  UPDATE public.sms_provider_secrets
     SET status='retired', updated_at=now(), updated_by=auth.uid()
   WHERE id=_id;
END $$;

-- 10. Status RPC for dashboard (no token bytes)
CREATE OR REPLACE FUNCTION public.get_sms_provider_status(_provider text DEFAULT 'greenweb')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active record; v_staged_count int; v_settings record; v_updater text; v_days int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT s.id, s.status, s.expires_at, s.activated_at, s.updated_at, s.updated_by, s.label
    INTO v_active
  FROM public.sms_provider_secrets s
  WHERE s.provider = _provider AND s.status = 'active'
  LIMIT 1;

  SELECT count(*) INTO v_staged_count
  FROM public.sms_provider_secrets
  WHERE provider = _provider AND status = 'staged';

  SELECT enabled, sender_id, config, updated_at INTO v_settings
  FROM public.sms_settings WHERE id = 1;

  IF v_active.updated_by IS NOT NULL THEN
    SELECT COALESCE(full_name, email, 'unknown') INTO v_updater
    FROM public.profiles WHERE id = v_active.updated_by;
  END IF;

  IF v_active.expires_at IS NOT NULL THEN
    v_days := GREATEST(0, EXTRACT(DAY FROM (v_active.expires_at - now()))::int);
  END IF;

  RETURN jsonb_build_object(
    'provider', _provider,
    'configured', v_active.id IS NOT NULL,
    'enabled', COALESCE(v_settings.enabled, false),
    'sender_id', v_settings.sender_id,
    'active_token_id', v_active.id,
    'active_label', v_active.label,
    'expires_at', v_active.expires_at,
    'days_to_expiry', v_days,
    'expired', v_active.expires_at IS NOT NULL AND v_active.expires_at < now(),
    'activated_at', v_active.activated_at,
    'last_updated', v_active.updated_at,
    'last_updater', v_updater,
    'staged_count', v_staged_count,
    'last_test', COALESCE(v_settings.config->'last_test', 'null'::jsonb)
  );
END $$;

-- 11. Token getter respects active+non-expired
CREATE OR REPLACE FUNCTION public.get_sms_provider_token(_provider text DEFAULT 'greenweb')
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT api_token
  FROM public.sms_provider_secrets
  WHERE provider = _provider
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.activate_sms_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retire_sms_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sms_provider_status(text) TO authenticated;