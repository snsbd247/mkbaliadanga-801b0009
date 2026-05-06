CREATE TABLE IF NOT EXISTS public.farmer_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  farmer_id uuid NULL,
  office_id uuid NULL,
  success boolean NOT NULL DEFAULT false,
  error_reason text NULL,
  ip text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fla_created_at ON public.farmer_login_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fla_ip_created ON public.farmer_login_attempts (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fla_farmer ON public.farmer_login_attempts (farmer_id);
CREATE INDEX IF NOT EXISTS idx_fla_office ON public.farmer_login_attempts (office_id);

ALTER TABLE public.farmer_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read farmer_login_attempts"
ON public.farmer_login_attempts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (is_admin_or_super(auth.uid()) AND (office_id IS NULL OR office_id = current_user_office()))
);
