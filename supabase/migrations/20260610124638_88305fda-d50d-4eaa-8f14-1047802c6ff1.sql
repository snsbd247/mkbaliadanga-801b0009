CREATE OR REPLACE FUNCTION public.count_farmer_invoices(_farmer_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.irrigation_invoices
  WHERE farmer_id = _farmer_id
    AND deleted_at IS NULL
    AND invoice_status <> 'cancelled';
$$;

REVOKE ALL ON FUNCTION public.count_farmer_invoices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_farmer_invoices(uuid) TO authenticated;