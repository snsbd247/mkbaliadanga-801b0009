CREATE OR REPLACE FUNCTION public.backfill_irrigation_invoice_office()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can run this action';
  END IF;

  WITH updated AS (
    UPDATE public.irrigation_invoices inv
    SET office_id = f.office_id
    FROM public.farmers f
    WHERE inv.farmer_id = f.id
      AND inv.office_id IS NULL
      AND f.office_id IS NOT NULL
    RETURNING inv.id
  )
  SELECT count(*) INTO fixed_count FROM updated;

  RETURN fixed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_irrigation_invoice_office() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backfill_irrigation_invoice_office() TO authenticated;