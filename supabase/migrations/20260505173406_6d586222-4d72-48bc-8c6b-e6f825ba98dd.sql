
CREATE TABLE IF NOT EXISTS public.mouzas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila_id uuid NOT NULL REFERENCES public.upazilas(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mouzas_upazila ON public.mouzas(upazila_id);

ALTER TABLE public.mouzas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read mouzas" ON public.mouzas;
CREATE POLICY "auth read mouzas" ON public.mouzas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin manage mouzas" ON public.mouzas;
CREATE POLICY "admin manage mouzas" ON public.mouzas FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "super manage divisions" ON public.divisions;
DROP POLICY IF EXISTS "admin manage divisions" ON public.divisions;
CREATE POLICY "admin manage divisions" ON public.divisions FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "super manage districts" ON public.districts;
DROP POLICY IF EXISTS "admin manage districts" ON public.districts;
CREATE POLICY "admin manage districts" ON public.districts FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "super manage upazilas" ON public.upazilas;
DROP POLICY IF EXISTS "admin manage upazilas" ON public.upazilas;
CREATE POLICY "admin manage upazilas" ON public.upazilas FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
