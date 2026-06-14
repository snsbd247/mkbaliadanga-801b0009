DROP POLICY IF EXISTS "super update loans" ON public.loans;
CREATE POLICY "admin update loans" ON public.loans
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND office_id = current_user_office())
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND office_id = current_user_office())
  );