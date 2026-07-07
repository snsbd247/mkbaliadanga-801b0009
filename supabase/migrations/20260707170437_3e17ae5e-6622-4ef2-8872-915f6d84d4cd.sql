-- Receipt serial semantic: receipt_serial_start = N means the NEXT issued receipt is N+1.
CREATE OR REPLACE FUNCTION public.next_serial_receipt_no()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start bigint := 0;
  v_no bigint;
BEGIN
  SELECT COALESCE(receipt_serial_start, 0) INTO v_start
  FROM public.receipt_settings WHERE id = 1;

  -- v_start is the LAST number the admin considers already used.
  -- The next issued number is therefore v_start + 1; raising the start jumps to it.
  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES ('SERIAL', 0, v_start + 1, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = GREATEST(public.receipt_counters.last_no + 1, v_start + 1),
                updated_at = now()
  RETURNING last_no INTO v_no;

  RETURN v_no::text;
END;
$function$;

NOTIFY pgrst, 'reload schema';