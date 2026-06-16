CREATE OR REPLACE FUNCTION public.void_receipt_and_recycle(
  p_receipt_no text,
  p_office_id uuid,
  p_reason text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized to void receipts';
  END IF;

  UPDATE public.payments
     SET voided_at = now(), voided_by = auth.uid(), void_reason = p_reason,
         status = 'voided'
   WHERE receipt_no = p_receipt_no AND voided_at IS NULL;

  UPDATE public.receipts
     SET voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   WHERE receipt_no = p_receipt_no AND voided_at IS NULL;

  INSERT INTO public.receipt_no_pool(office_id, receipt_no)
  VALUES (p_office_id, p_receipt_no)
  ON CONFLICT (receipt_no) DO NOTHING;
END;
$function$;