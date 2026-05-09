
-- Permission audit logs
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  role app_role,
  target_user_id uuid,
  module text NOT NULL,
  action text NOT NULL,
  old_value boolean,
  new_value boolean,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super read pal" ON public.permission_audit_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "super insert pal" ON public.permission_audit_logs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

-- has_permission security definer
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_super boolean;
  v_val boolean;
  v_role app_role;
BEGIN
  IF _action NOT IN ('can_view','can_add','can_edit','can_delete') THEN
    RETURN false;
  END IF;

  SELECT has_role(_user_id,'super_admin'::app_role) INTO v_super;
  IF v_super THEN RETURN true; END IF;

  -- Per-user override
  EXECUTE format('SELECT %I FROM public.user_permissions WHERE user_id=$1 AND module=$2', _action)
    INTO v_val USING _user_id, _module;
  IF v_val IS NOT NULL THEN RETURN v_val; END IF;

  -- Role-based
  FOR v_role IN SELECT role FROM public.user_roles WHERE user_id = _user_id LOOP
    EXECUTE format('SELECT %I FROM public.role_permissions WHERE role=$1 AND module=$2', _action)
      INTO v_val USING v_role, _module;
    IF v_val THEN RETURN true; END IF;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text,text) TO authenticated;
