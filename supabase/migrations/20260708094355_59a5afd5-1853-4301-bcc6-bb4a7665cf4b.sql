CREATE OR REPLACE FUNCTION public.delete_payment_cascade(_payment_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt_no text;
BEGIN
  IF NOT (public.is_committee_or_super(auth.uid())
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied: committee or super_admin required'
      USING ERRCODE = '42501';
  END IF;

  SELECT receipt_no INTO v_receipt_no
  FROM public.payments WHERE id = _payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Remove the accounting journal(s) posted for this payment's receipt.
  -- journal_entry_lines cascade automatically (FK ON DELETE CASCADE) and the
  -- post_journal_to_ledger trigger reverses the ledger on delete.
  IF v_receipt_no IS NOT NULL AND length(trim(v_receipt_no)) > 0 THEN
    DELETE FROM public.journal_entries WHERE reference = v_receipt_no;
  END IF;

  -- Remove irrigation links first so the AFTER DELETE recalc trigger restores
  -- each affected invoice's due_amount and invoice_status.
  DELETE FROM public.irrigation_invoice_payments WHERE payment_id = _payment_id;
  DELETE FROM public.payment_allocations WHERE payment_id = _payment_id;
  DELETE FROM public.payments WHERE id = _payment_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';