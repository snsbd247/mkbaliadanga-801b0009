-- Provider secrets table for SMS provider tokens (GreenWeb etc.)
CREATE TABLE IF NOT EXISTS public.sms_provider_secrets (
  provider text PRIMARY KEY,
  api_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.sms_provider_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin manage sms_provider_secrets" ON public.sms_provider_secrets;
CREATE POLICY "super admin manage sms_provider_secrets"
  ON public.sms_provider_secrets
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Keep sms_settings.api_key_set in sync
CREATE OR REPLACE FUNCTION public.sync_sms_api_key_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_has boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.sms_provider_secrets
    WHERE provider = 'greenweb' AND coalesce(api_token,'') <> ''
  ) INTO v_has;
  UPDATE public.sms_settings SET api_key_set = v_has, updated_at = now() WHERE id = 1;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_sms_api_key_set ON public.sms_provider_secrets;
CREATE TRIGGER trg_sync_sms_api_key_set
AFTER INSERT OR UPDATE OR DELETE ON public.sms_provider_secrets
FOR EACH ROW EXECUTE FUNCTION public.sync_sms_api_key_set();

-- Helper for backend to fetch token (security definer; super admin or service role)
CREATE OR REPLACE FUNCTION public.get_sms_provider_token(_provider text DEFAULT 'greenweb')
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT api_token FROM public.sms_provider_secrets WHERE provider = _provider;
$$;

REVOKE ALL ON FUNCTION public.get_sms_provider_token(text) FROM PUBLIC, anon, authenticated;