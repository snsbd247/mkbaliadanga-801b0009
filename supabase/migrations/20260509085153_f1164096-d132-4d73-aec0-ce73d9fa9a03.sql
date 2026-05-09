
CREATE TABLE public.season_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_bn text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.season_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read season_types" ON public.season_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage season_types" ON public.season_types FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TABLE public.field_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_bn text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read field_types" ON public.field_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage field_types" ON public.field_types FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

INSERT INTO public.season_types (code, name, name_bn, sort_order) VALUES
  ('boro','Boro','বোরো',10),
  ('aman','Aman','আমন',20),
  ('iri','Iri','ইরি',30),
  ('pukur','Pukur','পুকুর',40),
  ('doba','Doba','ডোবা',50),
  ('other','Other','অন্যান্য',99)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.field_types (code, name, name_bn, sort_order) VALUES
  ('high_land','High Land','উঁচু জমি',10),
  ('medium_land','Medium Land','মাঝারি জমি',20),
  ('low_land','Low Land','নিচু জমি',30),
  ('pukur','Pukur','পুকুর',40),
  ('doba','Doba','ডোবা',50),
  ('other','Other','অন্যান্য',99)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS season_type_id uuid REFERENCES public.season_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_seasons_season_type_id ON public.seasons(season_type_id);

UPDATE public.seasons s SET season_type_id = st.id
  FROM public.season_types st WHERE st.code = s.type::text AND s.season_type_id IS NULL;

CREATE TABLE public.season_field_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  field_type_code text NOT NULL,
  rate_per_shotok numeric NOT NULL DEFAULT 0,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_sfr ON public.season_field_rates(season_id, field_type_code, COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_sfr_season ON public.season_field_rates(season_id);

ALTER TABLE public.season_field_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office read sfr" ON public.season_field_rates FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "admin manage sfr" ON public.season_field_rates FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));

CREATE TRIGGER trg_sfr_updated_at BEFORE UPDATE ON public.season_field_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_season_types_updated_at BEFORE UPDATE ON public.season_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_field_types_updated_at BEFORE UPDATE ON public.field_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
