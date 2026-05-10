
CREATE TABLE IF NOT EXISTS public.irrigation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NULL,
  code text NOT NULL,
  name_bn text NULL,
  name_en text NULL,
  calculation_basis text NOT NULL DEFAULT 'per_shotok',
  allow_manual_negotiation boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT irrigation_categories_basis_chk
    CHECK (calculation_basis IN ('per_shotok','per_bigha','flat','custom'))
);
CREATE UNIQUE INDEX IF NOT EXISTS irrigation_categories_office_code_uq
  ON public.irrigation_categories (COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
  WHERE deleted_at IS NULL;

ALTER TABLE public.irrigation_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read irrigation_categories"
  ON public.irrigation_categories FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "admin manage irrigation_categories"
  ON public.irrigation_categories FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));

CREATE TRIGGER irrigation_categories_set_updated_at
  BEFORE UPDATE ON public.irrigation_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.irrigation_category_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NULL,
  irrigation_season_id uuid NOT NULL,
  irrigation_category_id uuid NOT NULL REFERENCES public.irrigation_categories(id) ON DELETE CASCADE,
  rate_type text NOT NULL DEFAULT 'per_shotok',
  rate numeric NOT NULL DEFAULT 0,
  unit text NULL,
  is_negotiable boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT irrigation_category_rates_type_chk
    CHECK (rate_type IN ('per_shotok','per_bigha','flat','custom'))
);
CREATE UNIQUE INDEX IF NOT EXISTS irrigation_category_rates_uq
  ON public.irrigation_category_rates
    (COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid), irrigation_season_id, irrigation_category_id);

ALTER TABLE public.irrigation_category_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read irrigation_category_rates"
  ON public.irrigation_category_rates FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "admin manage irrigation_category_rates"
  ON public.irrigation_category_rates FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));

CREATE TRIGGER irrigation_category_rates_set_updated_at
  BEFORE UPDATE ON public.irrigation_category_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.irrigation_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NULL,
  irrigation_invoice_id uuid NOT NULL,
  original_rate numeric NOT NULL DEFAULT 0,
  overridden_rate numeric NOT NULL DEFAULT 0,
  override_reason text NULL,
  approved_by uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS irrigation_rate_overrides_invoice_idx
  ON public.irrigation_rate_overrides (irrigation_invoice_id);

ALTER TABLE public.irrigation_rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read irrigation_rate_overrides"
  ON public.irrigation_rate_overrides FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "office insert irrigation_rate_overrides"
  ON public.irrigation_rate_overrides FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

ALTER TABLE public.irrigation_invoices
  ADD COLUMN IF NOT EXISTS irrigation_category_id uuid NULL,
  ADD COLUMN IF NOT EXISTS irrigation_category_name text NULL,
  ADD COLUMN IF NOT EXISTS rate_source text NULL,
  ADD COLUMN IF NOT EXISTS original_standard_rate numeric NULL,
  ADD COLUMN IF NOT EXISTS applied_rate numeric NULL,
  ADD COLUMN IF NOT EXISTS override_reason text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'irrigation_invoices_rate_source_chk') THEN
    ALTER TABLE public.irrigation_invoices
      ADD CONSTRAINT irrigation_invoices_rate_source_chk
      CHECK (rate_source IS NULL OR rate_source IN ('STANDARD','CATEGORY','MANUAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS irrigation_invoices_rate_source_idx ON public.irrigation_invoices (rate_source);
