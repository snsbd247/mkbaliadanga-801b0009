CREATE TABLE IF NOT EXISTS public.irrigation_partial_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allowed_roles text[] NOT NULL DEFAULT ARRAY['super_admin']::text[],
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.irrigation_partial_payment_settings TO authenticated;
GRANT ALL ON public.irrigation_partial_payment_settings TO service_role;

ALTER TABLE public.irrigation_partial_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read partial payment settings"
ON public.irrigation_partial_payment_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins manage partial payment settings"
ON public.irrigation_partial_payment_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'developer'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'developer'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_ipp_settings_updated_at ON public.irrigation_partial_payment_settings;
CREATE TRIGGER update_ipp_settings_updated_at BEFORE UPDATE ON public.irrigation_partial_payment_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.irrigation_partial_payment_settings (allowed_roles)
SELECT ARRAY['super_admin']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.irrigation_partial_payment_settings);