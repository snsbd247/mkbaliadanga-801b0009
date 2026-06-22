-- Union-name lookup table for geo hierarchy (upazila -> union -> mouza/village)
CREATE TABLE IF NOT EXISTS public.unions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upazila_id uuid REFERENCES public.upazilas(id) ON DELETE SET NULL,
  name text,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.unions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unions TO authenticated;
GRANT ALL ON public.unions TO service_role;

ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Unions are readable by everyone"
  ON public.unions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage unions"
  ON public.unions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_unions_upazila ON public.unions(upazila_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_unions_updated_at
  BEFORE UPDATE ON public.unions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();