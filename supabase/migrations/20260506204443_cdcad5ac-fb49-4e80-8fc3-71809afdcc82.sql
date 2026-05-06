
-- Update has_role-based helpers to treat developer as elevated
CREATE OR REPLACE FUNCTION public.is_developer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'developer'::public.app_role) $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role, 'developer'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_committee_or_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('committee'::public.app_role, 'super_admin'::public.app_role, 'developer'::public.app_role)
  )
$$;

-- Treat developer as super for has_role('super_admin') checks too
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (role = 'developer'::public.app_role AND _role IN ('super_admin'::public.app_role, 'admin'::public.app_role, 'committee'::public.app_role, 'staff'::public.app_role))
      )
  )
$$;

-- Helper: is the target user a developer?
CREATE OR REPLACE FUNCTION public.is_developer_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'developer'::public.app_role) $$;

-- ============ Hide developer users from non-developers ============
-- profiles: drop existing select policies and replace
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.profiles'::regclass AND polcmd = 'r' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "profiles read"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_developer(auth.uid())
  OR NOT public.is_developer_user(id)
);

-- user_roles: drop existing select policies and replace
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.user_roles'::regclass AND polcmd = 'r' LOOP
    EXECUTE format('DROP POLICY %I ON public.user_roles', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "user_roles read"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_developer(auth.uid())
  OR (public.is_admin_or_super(auth.uid()) AND NOT public.is_developer_user(user_id))
);

-- user_roles INSERT/UPDATE/DELETE: only developers may touch developer/super_admin rows;
-- nobody may modify their own roles
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.user_roles'::regclass AND polcmd <> 'r' LOOP
    EXECUTE format('DROP POLICY %I ON public.user_roles', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "user_roles insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  user_id <> auth.uid()
  AND (
    public.is_developer(auth.uid())
    OR (
      public.is_admin_or_super(auth.uid())
      AND role NOT IN ('developer'::public.app_role, 'super_admin'::public.app_role)
      AND NOT public.is_developer_user(user_id)
    )
  )
);

CREATE POLICY "user_roles update"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  user_id <> auth.uid()
  AND (
    public.is_developer(auth.uid())
    OR (
      public.is_admin_or_super(auth.uid())
      AND role NOT IN ('developer'::public.app_role, 'super_admin'::public.app_role)
      AND NOT public.is_developer_user(user_id)
    )
  )
)
WITH CHECK (
  user_id <> auth.uid()
  AND (
    public.is_developer(auth.uid())
    OR (
      public.is_admin_or_super(auth.uid())
      AND role NOT IN ('developer'::public.app_role, 'super_admin'::public.app_role)
      AND NOT public.is_developer_user(user_id)
    )
  )
);

CREATE POLICY "user_roles delete"
ON public.user_roles FOR DELETE TO authenticated
USING (
  user_id <> auth.uid()
  AND (
    public.is_developer(auth.uid())
    OR (
      public.is_admin_or_super(auth.uid())
      AND role NOT IN ('developer'::public.app_role, 'super_admin'::public.app_role)
      AND NOT public.is_developer_user(user_id)
    )
  )
);

-- Promote current super admin to developer
UPDATE public.user_roles
SET role = 'developer'::public.app_role
WHERE user_id = '0efd60c6-48eb-4a92-b392-59ed174a28e6';
