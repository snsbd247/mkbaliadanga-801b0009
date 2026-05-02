-- Role-based permission defaults editable by super admins
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read role_permissions" ON public.role_permissions;
CREATE POLICY "auth read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super manage role_permissions" ON public.role_permissions;
CREATE POLICY "super manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Seed defaults
INSERT INTO public.role_permissions(role, module, can_view, can_add, can_edit, can_delete) VALUES
-- super_admin: full
('super_admin','dashboard',true,true,true,true),
('super_admin','offices',true,true,true,true),
('super_admin','farmers',true,true,true,true),
('super_admin','seasons',true,true,true,true),
('super_admin','savings',true,true,true,true),
('super_admin','loans',true,true,true,true),
('super_admin','irrigation',true,true,true,true),
('super_admin','payments',true,true,true,true),
('super_admin','reports',true,true,true,true),
('super_admin','users',true,true,true,true),
('super_admin','audit',true,true,true,true),
('super_admin','settings',true,true,true,true),
-- admin: full ops, limited admin
('admin','dashboard',true,true,true,true),
('admin','offices',true,false,false,false),
('admin','farmers',true,true,true,true),
('admin','seasons',true,true,true,false),
('admin','savings',true,true,true,true),
('admin','loans',true,true,true,true),
('admin','irrigation',true,true,true,true),
('admin','payments',true,true,true,true),
('admin','reports',true,false,false,false),
('admin','users',true,true,true,false),
('admin','audit',true,false,false,false),
('admin','settings',true,false,true,false),
-- staff: operational
('staff','dashboard',true,false,false,false),
('staff','offices',false,false,false,false),
('staff','farmers',true,true,true,false),
('staff','seasons',true,false,false,false),
('staff','savings',true,true,false,false),
('staff','loans',true,true,false,false),
('staff','irrigation',true,true,false,false),
('staff','payments',true,true,false,false),
('staff','reports',true,false,false,false),
('staff','users',false,false,false,false),
('staff','audit',false,false,false,false),
('staff','settings',false,false,false,false),
-- committee: review/approval
('committee','dashboard',true,false,false,false),
('committee','offices',true,false,false,false),
('committee','farmers',true,false,true,false),
('committee','seasons',true,false,false,false),
('committee','savings',true,true,true,true),
('committee','loans',true,true,true,true),
('committee','irrigation',true,true,true,true),
('committee','payments',true,true,true,true),
('committee','reports',true,false,false,false),
('committee','users',false,false,false,false),
('committee','audit',true,false,false,false),
('committee','settings',false,false,false,false)
ON CONFLICT (role, module) DO NOTHING;