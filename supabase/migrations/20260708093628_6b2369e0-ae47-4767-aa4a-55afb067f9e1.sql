-- Change receipt serial semantics: the admin-entered "starting serial number"
-- is now the EXACT next receipt number to issue (not "last used + 1").
-- Previously entering 4641 produced 4642; now it produces 4641.

-- 1) Minting function: issue the configured start as-is (never below real usage).
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

  -- receipt_serial_start now means "the NEXT receipt number to issue".
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

  -- Issue the configured start directly. If it would collide with an existing
  -- active receipt (phantom drift / already-used), bump to just past it.
  v_no := GREATEST(v_start, v_max_used + 1);

  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES ('SERIAL', 0, v_no, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = v_no,
                updated_at = now();

  -- Advance the configured start to the following number for the next receipt.
  UPDATE public.receipt_settings
  SET receipt_serial_start = v_no + 1,
      updated_at = now()
  WHERE id = 1;

  RETURN v_no::text;
END;
$function$;

-- 2) Admin setter: store the entered value as the exact next number.
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
BEGIN
  IF NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_start IS NULL THEN
    RAISE EXCEPTION 'শুরুর ক্রমিক নম্বর দিতে হবে' USING ERRCODE = '22004';
  END IF;
  IF p_start < 1 THEN
    RAISE EXCEPTION 'ক্রমিক নম্বর ১ বা তার বেশি হতে হবে' USING ERRCODE = '22003';
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

  -- The entered value IS the next receipt number, so it must be greater than
  -- any receipt already used, otherwise it would duplicate an existing one.
  IF p_start <= v_max_used THEN
    RAISE EXCEPTION 'এই নম্বর (%) ইতিমধ্যে ব্যবহৃত সর্বশেষ রিসিপ্ট নম্বরের (%) চেয়ে বড় হতে হবে — ডুপ্লিকেট এড়াতে বাতিল করা হলো',
      p_start, v_max_used USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(receipt_serial_start, 0) INTO v_old
  FROM public.receipt_settings WHERE id = 1;

  UPDATE public.receipt_settings
  SET receipt_serial_start = p_start, updated_at = now(), updated_by = v_uid
  WHERE id = 1;

  -- Live counter reflects the last issued number, i.e. one below the next.
  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES ('SERIAL', 0, p_start - 1, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = p_start - 1, updated_at = now();

  INSERT INTO public.system_audit_logs (office_id, user_id, module, action_type, reference_id, old_data, new_data)
  VALUES (NULL, v_uid, 'receipt', 'update', NULL,
          jsonb_build_object('receipt_serial_start', v_old),
          jsonb_build_object('receipt_serial_start', p_start, 'next_receipt_no', p_start));

  RETURN p_start;
END;
$function$;

NOTIFY pgrst, 'reload schema';