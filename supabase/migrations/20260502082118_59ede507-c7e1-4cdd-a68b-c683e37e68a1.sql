-- ============================================================
-- LOCATION MANAGEMENT (additive, non-destructive)
-- ============================================================

-- Divisions
CREATE TABLE IF NOT EXISTS public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

-- Districts
CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid REFERENCES public.divisions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (division_id, name)
);
CREATE INDEX IF NOT EXISTS idx_districts_division ON public.districts(division_id);

-- Upazilas (sub-districts)
CREATE TABLE IF NOT EXISTS public.upazilas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid REFERENCES public.districts(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (district_id, name)
);
CREATE INDEX IF NOT EXISTS idx_upazilas_district ON public.upazilas(district_id);

-- Unions
CREATE TABLE IF NOT EXISTS public.unions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila_id uuid REFERENCES public.upazilas(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (upazila_id, name)
);
CREATE INDEX IF NOT EXISTS idx_unions_upazila ON public.unions(upazila_id);

-- Wards
CREATE TABLE IF NOT EXISTS public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id uuid REFERENCES public.unions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (union_id, name)
);
CREATE INDEX IF NOT EXISTS idx_wards_union ON public.wards(union_id);

-- Mouzas
CREATE TABLE IF NOT EXISTS public.mouzas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id uuid REFERENCES public.wards(id) ON DELETE RESTRICT,
  union_id uuid REFERENCES public.unions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_bn text,
  jl_no text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mouzas_ward ON public.mouzas(ward_id);
CREATE INDEX IF NOT EXISTS idx_mouzas_union ON public.mouzas(union_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mouzas_union_name ON public.mouzas(union_id, name) WHERE union_id IS NOT NULL;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_divisions_touch ON public.divisions;
CREATE TRIGGER trg_divisions_touch BEFORE UPDATE ON public.divisions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_districts_touch ON public.districts;
CREATE TRIGGER trg_districts_touch BEFORE UPDATE ON public.districts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_upazilas_touch ON public.upazilas;
CREATE TRIGGER trg_upazilas_touch BEFORE UPDATE ON public.upazilas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_unions_touch ON public.unions;
CREATE TRIGGER trg_unions_touch BEFORE UPDATE ON public.unions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_wards_touch ON public.wards;
CREATE TRIGGER trg_wards_touch BEFORE UPDATE ON public.wards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_mouzas_touch ON public.mouzas;
CREATE TRIGGER trg_mouzas_touch BEFORE UPDATE ON public.mouzas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upazilas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouzas    ENABLE ROW LEVEL SECURITY;

-- Read policies (any authenticated user)
DO $$ BEGIN
  CREATE POLICY "auth read divisions" ON public.divisions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read districts" ON public.districts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read upazilas" ON public.upazilas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read unions" ON public.unions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read wards" ON public.wards FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read mouzas" ON public.mouzas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Manage policies (super admin only)
DO $$ BEGIN
  CREATE POLICY "super manage divisions" ON public.divisions FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "super manage districts" ON public.districts FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "super manage upazilas" ON public.upazilas FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "super manage unions" ON public.unions FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "super manage wards" ON public.wards FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "super manage mouzas" ON public.mouzas FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Add nullable FKs to existing tables (no constraints that break old data)
-- ============================================================
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS upazila_id  uuid REFERENCES public.upazilas(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS union_id    uuid REFERENCES public.unions(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ward_id     uuid REFERENCES public.wards(id)     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mouza_id    uuid REFERENCES public.mouzas(id)    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_farmers_division ON public.farmers(division_id);
CREATE INDEX IF NOT EXISTS idx_farmers_district ON public.farmers(district_id);
CREATE INDEX IF NOT EXISTS idx_farmers_upazila  ON public.farmers(upazila_id);
CREATE INDEX IF NOT EXISTS idx_farmers_union    ON public.farmers(union_id);
CREATE INDEX IF NOT EXISTS idx_farmers_ward     ON public.farmers(ward_id);
CREATE INDEX IF NOT EXISTS idx_farmers_mouza    ON public.farmers(mouza_id);

ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS mouza_id uuid REFERENCES public.mouzas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lands_mouza ON public.lands(mouza_id);