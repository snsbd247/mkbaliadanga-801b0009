DROP POLICY IF EXISTS "super admin manage company_settings" ON public.company_settings;
CREATE POLICY "admins manage company_settings" ON public.company_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));