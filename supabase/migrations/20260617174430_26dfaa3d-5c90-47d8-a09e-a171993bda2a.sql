CREATE TABLE public.irrigation_cashbook_export_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id uuid,
  date_from date NOT NULL,
  date_to date NOT NULL,
  format text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.irrigation_cashbook_export_audit TO authenticated;
GRANT ALL ON public.irrigation_cashbook_export_audit TO service_role;

ALTER TABLE public.irrigation_cashbook_export_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own export audit"
ON public.irrigation_cashbook_export_audit
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own; admins view all export audit"
ON public.irrigation_cashbook_export_audit
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'developer')
);