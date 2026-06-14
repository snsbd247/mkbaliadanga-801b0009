CREATE OR REPLACE FUNCTION public.next_unified_receipt_no(p_office_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := extract(year from now())::int;
  m int := extract(month from now())::int;
  n int;
BEGIN
  INSERT INTO public.receipt_sequences(office_id, kind, year, month, last_no)
  VALUES (p_office_id, 'RCP', y, m, 1)
  ON CONFLICT (office_id, kind, year, month)
  DO UPDATE SET last_no = receipt_sequences.last_no + 1
  RETURNING last_no INTO n;
  RETURN format('RCP-%s-%s-%s', y, lpad(m::text, 2, '0'), lpad(n::text, 4, '0'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_unified_receipt_no(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_unified_receipt_no(uuid) TO service_role;