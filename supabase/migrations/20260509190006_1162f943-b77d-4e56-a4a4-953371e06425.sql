CREATE TABLE public.system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  user_id uuid,
  module text NOT NULL,
  action_type text NOT NULL,
  reference_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sal_office_created ON public.system_audit_logs(office_id, created_at DESC);
CREATE INDEX idx_sal_module ON public.system_audit_logs(module, created_at DESC);
CREATE INDEX idx_sal_reference ON public.system_audit_logs(reference_id);
CREATE INDEX idx_sal_user ON public.system_audit_logs(user_id);

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth insert sal" ON public.system_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR (user_id IS NULL));

CREATE POLICY "office read sal" ON public.system_audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (office_id = current_user_office()));

CREATE POLICY "super read sal" ON public.system_audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));