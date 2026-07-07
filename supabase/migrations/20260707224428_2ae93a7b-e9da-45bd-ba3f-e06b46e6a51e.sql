CREATE OR REPLACE FUNCTION public.admin_set_receipt_serial_start(p_start bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old bigint;
  v_max_used bigint := 0;
  v_floor bigint;
BEGIN
  IF NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_start IS NULL THEN
    RAISE EXCEPTION 'শুরুর ক্রমিক নম্বর দিতে হবে' USING ERRCODE = '22004';
  END IF;
  IF p_start < 0 THEN
    RAISE EXCEPTION 'ক্রমিক নম্বর ঋণাত্মক হতে পারবে না' USING ERRCODE = '22003';
  END IF;
  IF p_start > 9000000000 THEN
    RAISE EXCEPTION 'ক্রমিক নম্বর অনেক বড়' USING ERRCODE = '22003';
  END IF;

  -- Highest ACTUALLY used numeric receipt number across payments and receipts.
  SELECT COALESCE(MAX(n), 0) INTO v_max_used
  FROM (
    SELECT receipt_no::bigint AS n FROM public.payments WHERE receipt_no ~ '^[0-9]+$'
    UNION ALL
    SELECT receipt_no::bigint AS n FROM public.receipts WHERE receipt_no ~ '^[0-9]+$'
  ) x;

  -- Only reject when the requested start would collide with a real receipt.
  IF p_start < v_max_used THEN
    RAISE EXCEPTION 'এই নম্বর (%) প্রকৃতপক্ষে ব্যবহৃত সর্বশেষ রিসিপ্ট নম্বরের (%) চেয়ে ছোট — ডুপ্লিকেট এড়াতে বাতিল করা হলো',
      p_start, v_max_used USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(receipt_serial_start, 0) INTO v_old
  FROM public.receipt_settings WHERE id = 1;

  UPDATE public.receipt_settings
  SET receipt_serial_start = p_start, updated_at = now(), updated_by = v_uid
  WHERE id = 1;

  -- Reset the live counter so the next receipt is exactly p_start + 1
  -- (clearing any phantom drift), never below the highest real receipt.
  v_floor := GREATEST(p_start, v_max_used);
  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES ('SERIAL', 0, v_floor, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = v_floor, updated_at = now();

  INSERT INTO public.system_audit_logs (office_id, user_id, module, action_type, reference_id, old_data, new_data)
  VALUES (NULL, v_uid, 'receipt', 'update', NULL,
          jsonb_build_object('receipt_serial_start', v_old),
          jsonb_build_object('receipt_serial_start', p_start, 'counter_reset_to', v_floor));

  RETURN p_start;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_receipt_serial_start(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_receipt_serial_start(bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';