-- Allow authenticated users to read all irrigation invoices (office no longer hides them in farmer profile)
DROP POLICY IF EXISTS "office read irrigation_invoices" ON public.irrigation_invoices;
CREATE POLICY "read irrigation_invoices"
  ON public.irrigation_invoices FOR SELECT
  TO authenticated
  USING (true);