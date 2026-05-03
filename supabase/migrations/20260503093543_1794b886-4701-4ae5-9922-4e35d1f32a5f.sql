-- Tighten voter_audit_logs RLS: keep office-scoped read, explicitly forbid client writes
ALTER TABLE public.voter_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read voter_audit" ON public.voter_audit_logs;
CREATE POLICY "office read voter_audit"
ON public.voter_audit_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (office_id IS NOT NULL AND office_id = current_user_office())
);

-- Explicitly deny client INSERT/UPDATE/DELETE; only the SECURITY DEFINER trigger writes here
DROP POLICY IF EXISTS "deny client insert voter_audit" ON public.voter_audit_logs;
CREATE POLICY "deny client insert voter_audit"
ON public.voter_audit_logs FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny client update voter_audit" ON public.voter_audit_logs;
CREATE POLICY "deny client update voter_audit"
ON public.voter_audit_logs FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "deny client delete voter_audit" ON public.voter_audit_logs;
CREATE POLICY "deny client delete voter_audit"
ON public.voter_audit_logs FOR DELETE TO authenticated USING (false);