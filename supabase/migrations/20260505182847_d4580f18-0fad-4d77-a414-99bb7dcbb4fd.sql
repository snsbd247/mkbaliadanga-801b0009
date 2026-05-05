-- 1) Convert generate_member_no to SECURITY INVOKER (no elevated privs needed)
DROP FUNCTION IF EXISTS public.generate_member_no();
CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
  v_candidate text;
  v_exists boolean;
BEGIN
  LOOP
    v_next := nextval('public.farmer_member_seq');
    v_candidate := 'MK-' || lpad(v_next::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.farmers WHERE member_no = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_candidate;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_member_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_member_no() TO authenticated;
GRANT USAGE ON SEQUENCE public.farmer_member_seq TO authenticated;

-- 2) Trigger-only function: no EXECUTE needed
REVOKE EXECUTE ON FUNCTION public.allocate_loan_payment_to_installments() FROM PUBLIC, anon, authenticated;

-- 3) Loan installment status consistency guard (trigger)
CREATE OR REPLACE FUNCTION public.enforce_loan_installment_status_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.paid_amount := COALESCE(NEW.paid_amount, 0);
  IF NEW.paid_amount < 0 THEN
    RAISE EXCEPTION 'paid_amount cannot be negative';
  END IF;
  IF NEW.paid_amount > NEW.amount + 0.005 THEN
    RAISE EXCEPTION 'paid_amount (%) cannot exceed installment amount (%)', NEW.paid_amount, NEW.amount;
  END IF;
  IF NEW.paid_amount = 0 THEN
    NEW.status := 'due'::installment_status;
  ELSIF NEW.paid_amount + 0.005 < NEW.amount THEN
    NEW.status := 'partial'::installment_status;
  ELSE
    NEW.status := 'paid'::installment_status;
    IF NEW.paid_on IS NULL THEN NEW.paid_on := CURRENT_DATE; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_loan_installment_status ON public.loan_installments;
CREATE TRIGGER trg_loan_installment_status
BEFORE INSERT OR UPDATE OF paid_amount, amount, status ON public.loan_installments
FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_installment_status_consistency();

-- 4) Loan-level reconciliation function — returns mismatched loans
CREATE OR REPLACE FUNCTION public.validate_loan_installment_consistency(_office uuid DEFAULT NULL)
RETURNS TABLE(
  loan_id uuid,
  farmer_id uuid,
  total_payable numeric,
  installments_total numeric,
  installments_paid numeric,
  approved_payments_total numeric,
  status_mismatch boolean,
  amount_mismatch boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH inst AS (
    SELECT loan_id,
           SUM(amount) AS total_amt,
           SUM(paid_amount) AS total_paid,
           bool_or(
             (paid_amount = 0 AND status <> 'due') OR
             (paid_amount > 0 AND paid_amount + 0.005 < amount AND status <> 'partial') OR
             (paid_amount + 0.005 >= amount AND status <> 'paid')
           ) AS bad_status
    FROM public.loan_installments
    GROUP BY loan_id
  ),
  pay AS (
    SELECT loan_id, COALESCE(SUM(amount), 0) AS total_pay
    FROM public.loan_payments
    WHERE status = 'approved'
    GROUP BY loan_id
  )
  SELECT l.id, l.farmer_id, l.total_payable,
         COALESCE(i.total_amt, 0),
         COALESCE(i.total_paid, 0),
         COALESCE(p.total_pay, 0),
         COALESCE(i.bad_status, false),
         ABS(COALESCE(i.total_paid, 0) - COALESCE(p.total_pay, 0)) > 0.01
  FROM public.loans l
  LEFT JOIN inst i ON i.loan_id = l.id
  LEFT JOIN pay  p ON p.loan_id = l.id
  WHERE l.deleted_at IS NULL
    AND (_office IS NULL OR l.office_id = _office)
    AND (COALESCE(i.bad_status, false) OR ABS(COALESCE(i.total_paid, 0) - COALESCE(p.total_pay, 0)) > 0.01);
$$;

REVOKE EXECUTE ON FUNCTION public.validate_loan_installment_consistency(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_loan_installment_consistency(uuid) TO authenticated;