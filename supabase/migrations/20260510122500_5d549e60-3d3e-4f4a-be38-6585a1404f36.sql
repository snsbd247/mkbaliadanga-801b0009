ALTER TABLE public.irrigation_rate_overrides
  ADD CONSTRAINT irrigation_rate_overrides_invoice_fkey
  FOREIGN KEY (irrigation_invoice_id)
  REFERENCES public.irrigation_invoices(id)
  ON DELETE CASCADE;

DROP POLICY IF EXISTS "office read irrigation_category_rates" ON public.irrigation_category_rates;
CREATE POLICY "office read irrigation_category_rates"
  ON public.irrigation_category_rates
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR office_id IS NULL
    OR office_id = current_user_office()
  );

NOTIFY pgrst, 'reload schema';