
CREATE TABLE IF NOT EXISTS public.demo_operations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  modules text[] NOT NULL DEFAULT '{}',
  size integer,
  ip text,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  summary jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_operations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super read demo_ops" ON public.demo_operations_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_demo_ops_created ON public.demo_operations_log(created_at DESC);
