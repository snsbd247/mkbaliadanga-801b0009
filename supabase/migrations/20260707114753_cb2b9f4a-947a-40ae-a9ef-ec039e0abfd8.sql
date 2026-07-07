CREATE OR REPLACE FUNCTION public.tg_validate_invoice_payment_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pay_farmer uuid;
  v_pay_office uuid;
  v_inv_farmer uuid;
  v_inv_office uuid;
  v_payable numeric;
BEGIN
  SELECT farmer_id, office_id INTO v_pay_farmer, v_pay_office
    FROM public.payments WHERE id = NEW.payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found for coverage row', NEW.payment_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT farmer_id, office_id, COALESCE(payable_amount, 0)
    INTO v_inv_farmer, v_inv_office, v_payable
    FROM public.irrigation_invoices WHERE id = NEW.invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found for coverage row', NEW.invoice_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_inv_farmer IS DISTINCT FROM v_pay_farmer THEN
    RAISE EXCEPTION 'Invoice % does not belong to the payment''s farmer', NEW.invoice_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_pay_office IS NOT NULL AND v_inv_office IS DISTINCT FROM v_pay_office THEN
    RAISE EXCEPTION 'Invoice % does not belong to the payment''s office', NEW.invoice_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reject a single allocation larger than the invoice's own payable amount
  -- (guards against a client sending a tampered collected_amount).
  IF COALESCE(NEW.collected_amount, 0) > v_payable + 0.5 THEN
    RAISE EXCEPTION 'Allocation % exceeds invoice payable %', NEW.collected_amount, v_payable
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_invoice_payment_scope ON public.irrigation_invoice_payments;
CREATE TRIGGER trg_validate_invoice_payment_scope
BEFORE INSERT OR UPDATE ON public.irrigation_invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_invoice_payment_scope();

NOTIFY pgrst, 'reload schema';