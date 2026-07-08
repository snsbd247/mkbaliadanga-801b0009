CREATE OR REPLACE FUNCTION public.next_serial_receipt_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start bigint := 0;
  v_max_used bigint := 0;
  v_no bigint;
BEGIN
  INSERT INTO public.receipt_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(receipt_serial_start, 0)
    INTO v_start
  FROM public.receipt_settings
  WHERE id = 1
  FOR UPDATE;

  SELECT COALESCE(MAX(n), 0)
    INTO v_max_used
  FROM (
    SELECT receipt_no::bigint AS n
    FROM public.payments
    WHERE receipt_no ~ '^[0-9]+$'
      AND deleted_at IS NULL
      AND voided_at IS NULL
      AND COALESCE(status::text, '') <> 'voided'
    UNION ALL
    SELECT receipt_no::bigint AS n
    FROM public.receipts
    WHERE receipt_no ~ '^[0-9]+$'
      AND voided_at IS NULL
  ) used_receipts;

  -- receipt_serial_start is the LAST issued/accepted serial. The next number is one more.
  -- If the counter drifted because a payment was deleted before receipt_no was finalized,
  -- real active receipts + the locked setting decide the next value.
  v_no := GREATEST(v_start, v_max_used) + 1;

  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES ('SERIAL', 0, v_no, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = v_no,
                updated_at = now();

  UPDATE public.receipt_settings
  SET receipt_serial_start = v_no,
      updated_at = now()
  WHERE id = 1;

  RETURN v_no::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.next_serial_receipt_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_serial_receipt_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_serial_receipt_no() TO service_role;

NOTIFY pgrst, 'reload schema';