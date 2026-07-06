
-- ---- Task 3: legacy receipt-number mapping (non-destructive) ----
CREATE TABLE IF NOT EXISTS public.receipt_no_legacy_map (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  legacy_receipt_no text NOT NULL,
  numeric_alias bigint NOT NULL,
  office_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

GRANT SELECT ON public.receipt_no_legacy_map TO authenticated;
GRANT ALL ON public.receipt_no_legacy_map TO service_role;

ALTER TABLE public.receipt_no_legacy_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read receipt_no_legacy_map"
  ON public.receipt_no_legacy_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "super admin manage receipt_no_legacy_map"
  ON public.receipt_no_legacy_map FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- One-time backfill: assign a sequential numeric alias to each legacy receipt
-- number, ordered by creation time, without mutating the source rows.
WITH legacy AS (
  SELECT 'payments'::text AS source_table, id AS source_id, receipt_no AS legacy_receipt_no, office_id, created_at
  FROM public.payments
  WHERE receipt_no ~ '^(RCPT|RCP|R)-'
  UNION ALL
  SELECT 'savings_transactions', id, receipt_no, office_id, created_at
  FROM public.savings_transactions
  WHERE receipt_no ~ '^(RCPT|RCP|R)-'
  UNION ALL
  SELECT 'receipts', id, receipt_no, office_id, created_at
  FROM public.receipts
  WHERE receipt_no ~ '^(RCPT|RCP|R)-'
),
numbered AS (
  SELECT *, row_number() OVER (ORDER BY created_at, source_table, source_id) AS numeric_alias
  FROM legacy
)
INSERT INTO public.receipt_no_legacy_map (source_table, source_id, legacy_receipt_no, numeric_alias, office_id)
SELECT source_table, source_id, legacy_receipt_no, numeric_alias, office_id
FROM numbered
ON CONFLICT (source_table, source_id) DO NOTHING;

-- ---- Tasks 2 + 4: server-side validated update with audit trail ----
CREATE OR REPLACE FUNCTION public.admin_set_receipt_serial_start(p_start bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old bigint;
  v_current_last bigint := 0;
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

  SELECT COALESCE(last_no, 0) INTO v_current_last
  FROM public.receipt_counters WHERE kind = 'SERIAL' AND year = 0;

  IF p_start < COALESCE(v_current_last, 0) THEN
    RAISE EXCEPTION 'এই নম্বর (%) বর্তমান সর্বশেষ রিসিপ্ট নম্বরের (%) চেয়ে ছোট — ডুপ্লিকেট এড়াতে বাতিল করা হলো',
      p_start, v_current_last USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(receipt_serial_start, 0) INTO v_old
  FROM public.receipt_settings WHERE id = 1;

  UPDATE public.receipt_settings
  SET receipt_serial_start = p_start, updated_at = now(), updated_by = v_uid
  WHERE id = 1;

  INSERT INTO public.system_audit_logs (office_id, user_id, module, action_type, reference_id, old_data, new_data)
  VALUES (NULL, v_uid, 'receipt', 'update', NULL,
          jsonb_build_object('receipt_serial_start', v_old),
          jsonb_build_object('receipt_serial_start', p_start));

  RETURN p_start;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_receipt_serial_start(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_receipt_serial_start(bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';
