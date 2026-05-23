
ALTER TABLE public.sms_provider_secrets
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS dlr_url text;

CREATE INDEX IF NOT EXISTS idx_sms_provider_secrets_priority
  ON public.sms_provider_secrets (status, priority);

ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS preferred_provider text;

ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS provider_used text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS dlr_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_sms_logs_delivered_at
  ON public.sms_logs (delivered_at DESC) WHERE delivered_at IS NOT NULL;
