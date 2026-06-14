DROP POLICY IF EXISTS "admin update loans" ON public.loans;
CREATE POLICY "loans edit by permission" ON public.loans
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_permission(auth.uid(), 'loans', 'can_edit') AND (office_id = current_user_office() OR office_id IS NULL))
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_permission(auth.uid(), 'loans', 'can_edit') AND (office_id = current_user_office() OR office_id IS NULL))
  );