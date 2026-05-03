CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.irrigation_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NOT NULL,
  season_id uuid NOT NULL,
  basis irrigation_basis NOT NULL DEFAULT 'per_size',
  base_rate numeric NOT NULL DEFAULT 0,
  canal_charge numeric NOT NULL DEFAULT 0,
  maintenance_charge numeric NOT NULL DEFAULT 0,
  other_charge numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (office_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_irrigation_rates_office_season
  ON public.irrigation_rates (office_id, season_id);

ALTER TABLE public.irrigation_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read irrigation_rates"
  ON public.irrigation_rates FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "admin insert irrigation_rates"
  ON public.irrigation_rates FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office()));

CREATE POLICY "admin update irrigation_rates"
  ON public.irrigation_rates FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office()));

CREATE POLICY "admin delete irrigation_rates"
  ON public.irrigation_rates FOR DELETE TO authenticated
  USING (is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office()));

CREATE TRIGGER trg_irrigation_rates_updated_at
  BEFORE UPDATE ON public.irrigation_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();