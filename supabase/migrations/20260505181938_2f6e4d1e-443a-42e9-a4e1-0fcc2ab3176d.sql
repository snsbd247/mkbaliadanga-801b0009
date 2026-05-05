CREATE OR REPLACE FUNCTION public.allocate_loan_payment_to_installments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := NEW.amount;
  r record;
  v_apply numeric;
  v_total numeric;
  v_paid numeric;
BEGIN
  IF v_remaining IS NULL OR v_remaining <= 0 THEN RETURN NEW; END IF;

  FOR r IN
    SELECT id, amount, COALESCE(paid_amount,0) AS paid_amount
    FROM public.loan_installments
    WHERE loan_id = NEW.loan_id
      AND COALESCE(paid_amount,0) < amount
    ORDER BY installment_no
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(r.amount - r.paid_amount, v_remaining);
    UPDATE public.loan_installments
       SET paid_amount = r.paid_amount + v_apply,
           paid_on = CASE WHEN r.paid_amount + v_apply >= r.amount THEN NEW.paid_on ELSE paid_on END,
           status = CASE
             WHEN r.paid_amount + v_apply >= r.amount THEN 'paid'::installment_status
             ELSE 'partial'::installment_status
           END,
           updated_at = now()
     WHERE id = r.id;
    v_remaining := v_remaining - v_apply;
  END LOOP;

  -- Update loan summary status if fully paid
  SELECT total_payable INTO v_total FROM public.loans WHERE id = NEW.loan_id;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.loan_payments WHERE loan_id = NEW.loan_id;
  IF v_total IS NOT NULL AND v_paid >= v_total THEN
    UPDATE public.loans SET status = 'paid'::loan_status, updated_at = now() WHERE id = NEW.loan_id;
  END IF;

  -- Update next_due_on
  UPDATE public.loans
     SET next_due_on = (SELECT MIN(due_date) FROM public.loan_installments
                       WHERE loan_id = NEW.loan_id AND COALESCE(paid_amount,0) < amount)
   WHERE id = NEW.loan_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_allocate_loan_payment ON public.loan_payments;
CREATE TRIGGER trg_allocate_loan_payment
AFTER INSERT ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.allocate_loan_payment_to_installments();

REVOKE EXECUTE ON FUNCTION public.allocate_loan_payment_to_installments() FROM PUBLIC, anon, authenticated;
