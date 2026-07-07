DROP POLICY IF EXISTS "admin update irrigation_invoices" ON public.irrigation_invoices;

CREATE POLICY "office update irrigation_invoices"
ON public.irrigation_invoices
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR office_id = current_user_office()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR office_id = current_user_office()
);