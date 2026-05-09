-- 1. Tighten profiles policies so super_admin (non-developer) cannot SELECT/modify developer profiles
DROP POLICY IF EXISTS "super admin manage profiles" ON public.profiles;

CREATE POLICY "super admin insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    public.is_developer(auth.uid())
    OR (public.has_role(auth.uid(), 'super_admin') AND NOT public.is_developer_user(id))
  );

CREATE POLICY "super admin update profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.is_developer(auth.uid())
    OR (public.has_role(auth.uid(), 'super_admin') AND NOT public.is_developer_user(id))
  )
  WITH CHECK (
    public.is_developer(auth.uid())
    OR (public.has_role(auth.uid(), 'super_admin') AND NOT public.is_developer_user(id))
  );

CREATE POLICY "super admin delete profiles"
  ON public.profiles FOR DELETE
  USING (
    public.is_developer(auth.uid())
    OR (public.has_role(auth.uid(), 'super_admin') AND NOT public.is_developer_user(id))
  );

-- 2. Audit helper for developer-account access attempts
CREATE OR REPLACE FUNCTION public.log_developer_access(_action text, _blocked boolean DEFAULT false, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.audit_logs (user_id, action, entity, meta)
  VALUES (
    uid,
    _action,
    'developer_users',
    jsonb_build_object('blocked', _blocked, 'is_developer', public.is_developer(uid)) || COALESCE(_meta, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_developer_access(text, boolean, jsonb) TO authenticated;