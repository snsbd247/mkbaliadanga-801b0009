-- Add expiry & rotation lineage to qr_tokens
ALTER TABLE public.qr_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rotated_from uuid;

CREATE INDEX IF NOT EXISTS idx_qr_tokens_farmer_active
  ON public.qr_tokens(farmer_id) WHERE revoked = false;

-- Singleton settings table for scheduled QR rotation
CREATE TABLE IF NOT EXISTS public.qr_rotation_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  interval_days integer NOT NULL DEFAULT 90 CHECK (interval_days BETWEEN 1 AND 3650),
  grace_hours integer NOT NULL DEFAULT 24 CHECK (grace_hours BETWEEN 0 AND 720),
  last_run_at timestamptz,
  last_run_summary jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.qr_rotation_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.qr_rotation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read qr_rotation_settings" ON public.qr_rotation_settings;
CREATE POLICY "auth read qr_rotation_settings"
  ON public.qr_rotation_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super manage qr_rotation_settings" ON public.qr_rotation_settings;
CREATE POLICY "super manage qr_rotation_settings"
  ON public.qr_rotation_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
