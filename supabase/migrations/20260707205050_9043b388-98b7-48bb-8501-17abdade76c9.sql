DROP POLICY IF EXISTS "super admin manage receipt_settings" ON public.receipt_settings;
CREATE POLICY "super admin manage receipt_settings"
ON public.receipt_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role));