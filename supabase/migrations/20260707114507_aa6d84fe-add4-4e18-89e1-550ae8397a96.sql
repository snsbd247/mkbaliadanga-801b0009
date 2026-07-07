CREATE OR REPLACE FUNCTION public.tg_recalc_invoice_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_id uuid;
  v_paid numeric;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recompute paid_amount from the sum of all persisted allocation rows so the
  -- invoice due/status can never get stuck out of sync with its payments.
  SELECT COALESCE(SUM(collected_amount), 0)
    INTO v_paid
    FROM public.irrigation_invoice_payments
   WHERE invoice_id = v_invoice_id;

  -- The BEFORE UPDATE trigger tg_irrigation_invoice_recalc recomputes
  -- payable_amount, due_amount and invoice_status from paid_amount, so writing
  -- paid_amount here keeps everything consistent in one atomic statement.
  UPDATE public.irrigation_invoices
     SET paid_amount = v_paid
   WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_invoice_from_payments ON public.irrigation_invoice_payments;
CREATE TRIGGER trg_recalc_invoice_from_payments
AFTER INSERT OR UPDATE OR DELETE ON public.irrigation_invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_invoice_from_payments();

NOTIFY pgrst, 'reload schema';