-- 1) Remove orphan rows so we can add strict FK constraints.
DELETE FROM public.irrigation_invoice_payments iip
WHERE iip.payment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = iip.payment_id);

DELETE FROM public.payment_allocations pa
WHERE pa.payment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = pa.payment_id);

-- 2) Enforce ON DELETE CASCADE from these child tables to payments.
ALTER TABLE public.irrigation_invoice_payments
  DROP CONSTRAINT IF EXISTS irrigation_invoice_payments_payment_id_fkey;
ALTER TABLE public.irrigation_invoice_payments
  ADD CONSTRAINT irrigation_invoice_payments_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;

ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_payment_id_fkey;
ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;

-- 3) Audit the permanent delete with affected row counts per table.
CREATE OR REPLACE FUNCTION public.delete_payment_cascade(_payment_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt_no text;
  v_office_id uuid;
  v_farmer_id uuid;
  v_amount numeric;
  v_jl int := 0;
  v_je int := 0;
  v_iip int := 0;
  v_pa int := 0;
BEGIN
  IF NOT (public.is_committee_or_super(auth.uid())
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied: committee or super_admin required'
      USING ERRCODE = '42501';
  END IF;

  SELECT receipt_no, office_id, farmer_id, amount
    INTO v_receipt_no, v_office_id, v_farmer_id, v_amount
  FROM public.payments WHERE id = _payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Delete accounting journals posted for this receipt and count affected rows.
  IF v_receipt_no IS NOT NULL AND length(trim(v_receipt_no)) > 0 THEN
    SELECT COUNT(*) INTO v_jl
    FROM public.journal_entry_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_id
    WHERE je.reference = v_receipt_no;

    WITH del AS (
      DELETE FROM public.journal_entries WHERE reference = v_receipt_no RETURNING 1
    )
    SELECT COUNT(*) INTO v_je FROM del;
  END IF;

  WITH del AS (
    DELETE FROM public.irrigation_invoice_payments WHERE payment_id = _payment_id RETURNING 1
  )
  SELECT COUNT(*) INTO v_iip FROM del;

  WITH del AS (
    DELETE FROM public.payment_allocations WHERE payment_id = _payment_id RETURNING 1
  )
  SELECT COUNT(*) INTO v_pa FROM del;

  DELETE FROM public.payments WHERE id = _payment_id;

  INSERT INTO public.system_audit_logs (office_id, user_id, module, action_type, reference_id, old_data, new_data)
  VALUES (
    v_office_id, auth.uid(), 'payments', 'delete', _payment_id::text,
    jsonb_build_object(
      'receipt_no', v_receipt_no,
      'farmer_id', v_farmer_id,
      'amount', v_amount
    ),
    jsonb_build_object(
      'permanent_delete', true,
      'affected', jsonb_build_object(
        'payments', 1,
        'irrigation_invoice_payments', v_iip,
        'payment_allocations', v_pa,
        'journal_entries', v_je,
        'journal_entry_lines', v_jl
      )
    )
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';