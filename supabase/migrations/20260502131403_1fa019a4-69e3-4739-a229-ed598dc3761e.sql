-- Force RLS so privileged roles also go through policies
ALTER TABLE public.sms_provider_secrets FORCE ROW LEVEL SECURITY;

-- Revoke any direct grants; only the super-admin RLS policy should allow access
REVOKE ALL ON TABLE public.sms_provider_secrets FROM anon;
REVOKE ALL ON TABLE public.sms_provider_secrets FROM authenticated;
REVOKE ALL ON TABLE public.sms_provider_secrets FROM PUBLIC;

-- Re-grant the minimum needed for the existing super-admin RLS policy to be evaluable
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sms_provider_secrets TO authenticated;

-- Ensure no duplicate/over-broad policies
DROP POLICY IF EXISTS "auth read sms_provider_secrets" ON public.sms_provider_secrets;
DROP POLICY IF EXISTS "anyone read sms_provider_secrets" ON public.sms_provider_secrets;

-- Re-create the canonical super-admin-only policy (idempotent)
DROP POLICY IF EXISTS "super admin manage sms_provider_secrets" ON public.sms_provider_secrets;
CREATE POLICY "super admin manage sms_provider_secrets"
ON public.sms_provider_secrets
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));