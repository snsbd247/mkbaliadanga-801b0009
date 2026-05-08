-- Updated_at helper (create if missing)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.patwaris (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_bn TEXT,
  mobile TEXT,
  nid TEXT,
  address TEXT,
  mouza_id UUID REFERENCES public.mouzas(id) ON DELETE SET NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_patwaris_office ON public.patwaris(office_id);
CREATE INDEX idx_patwaris_mouza ON public.patwaris(mouza_id);
CREATE INDEX idx_patwaris_active ON public.patwaris(is_active) WHERE is_active = true;

ALTER TABLE public.patwaris ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read patwaris"
  ON public.patwaris FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR office_id IS NULL
    OR office_id = current_user_office()
  );

CREATE POLICY "admin insert patwaris"
  ON public.patwaris FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL)
  );

CREATE POLICY "admin update patwaris"
  ON public.patwaris FOR UPDATE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office())
  );

CREATE POLICY "admin delete patwaris"
  ON public.patwaris FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office())
  );

CREATE TRIGGER trg_patwaris_updated_at
  BEFORE UPDATE ON public.patwaris
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.irrigation_charges
  ADD COLUMN patwari_id UUID REFERENCES public.patwaris(id) ON DELETE SET NULL;

CREATE INDEX idx_irrigation_charges_patwari ON public.irrigation_charges(patwari_id);