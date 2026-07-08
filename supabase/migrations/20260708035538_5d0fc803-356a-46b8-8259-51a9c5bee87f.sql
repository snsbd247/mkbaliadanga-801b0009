
DROP POLICY IF EXISTS "office update irrigation_invoices" ON public.irrigation_invoices;
CREATE POLICY "office update irrigation_invoices" ON public.irrigation_invoices
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role) OR (office_id = current_user_office()))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role) OR (office_id = current_user_office()));

DROP POLICY IF EXISTS "super delete irrigation_invoices" ON public.irrigation_invoices;
CREATE POLICY "super delete irrigation_invoices" ON public.irrigation_invoices
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role));
