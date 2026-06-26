CREATE TABLE public.land_transfer_integrity_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'completed',
  office_id UUID NULL REFERENCES public.offices(id) ON DELETE SET NULL,
  date_from DATE NULL,
  date_to DATE NULL,
  total_transfers INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB NULL,
  violations JSONB NULL,
  error_message TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_transfer_integrity_runs TO authenticated;
GRANT ALL ON public.land_transfer_integrity_runs TO service_role;

ALTER TABLE public.land_transfer_integrity_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integrity runs"
ON public.land_transfer_integrity_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can insert integrity runs"
ON public.land_transfer_integrity_runs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Admins can update integrity runs"
ON public.land_transfer_integrity_runs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'developer'));

CREATE TRIGGER update_lt_integrity_runs_updated_at
BEFORE UPDATE ON public.land_transfer_integrity_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();