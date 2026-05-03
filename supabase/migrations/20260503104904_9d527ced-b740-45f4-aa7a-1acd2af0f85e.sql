CREATE TABLE public.import_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  office_id uuid,
  module text NOT NULL,
  mode text NOT NULL DEFAULT 'insert',
  rows_processed integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  error_report_url text,
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth insert own import_audit"
ON public.import_audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin read import_audit"
ON public.import_audit_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (is_admin_or_super(auth.uid()) AND (office_id IS NULL OR office_id = current_user_office()))
  OR user_id = auth.uid()
);

CREATE INDEX idx_import_audit_user ON public.import_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_import_audit_office ON public.import_audit_logs(office_id, created_at DESC);