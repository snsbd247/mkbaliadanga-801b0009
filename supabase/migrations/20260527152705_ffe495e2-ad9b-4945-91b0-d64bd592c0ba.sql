
-- Group E: Loan guarantors, flexible repayment mode, repayment tracking, receipt #
CREATE TABLE IF NOT EXISTS public.loan_guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  farmer_id uuid REFERENCES public.farmers(id) ON DELETE SET NULL,
  name text NOT NULL,
  father_name text,
  village text,
  mobile text,
  nid text,
  office_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_loan ON public.loan_guarantors(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_office ON public.loan_guarantors(office_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_guarantors TO authenticated;
GRANT ALL ON public.loan_guarantors TO service_role;

ALTER TABLE public.loan_guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read loan guarantors" ON public.loan_guarantors
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "office write loan guarantors" ON public.loan_guarantors
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "office update loan guarantors" ON public.loan_guarantors
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());
CREATE POLICY "office delete loan guarantors" ON public.loan_guarantors
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

-- Loans: repayment mode + fully paid tracking
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS repayment_mode text NOT NULL DEFAULT 'installment',
  ADD COLUMN IF NOT EXISTS fully_paid_on date;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loans_repayment_mode_check') THEN
    ALTER TABLE public.loans ADD CONSTRAINT loans_repayment_mode_check
      CHECK (repayment_mode IN ('installment','bullet'));
  END IF;
END $$;

-- Loan payments: receipt # for installment list
ALTER TABLE public.loan_payments
  ADD COLUMN IF NOT EXISTS receipt_no text;

-- Trigger: when loan becomes fully paid, stamp fully_paid_on from latest payment
CREATE OR REPLACE FUNCTION public.update_loan_fully_paid_on()
RETURNS TRIGGER AS $$
DECLARE
  v_payable numeric;
  v_paid numeric;
BEGIN
  SELECT total_payable INTO v_payable FROM public.loans WHERE id = NEW.loan_id;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.loan_payments WHERE loan_id = NEW.loan_id;
  IF v_payable > 0 AND v_paid >= v_payable THEN
    UPDATE public.loans
      SET fully_paid_on = COALESCE(fully_paid_on, NEW.paid_on),
          status = 'paid'
      WHERE id = NEW.loan_id AND fully_paid_on IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_loan_payment_full_paid ON public.loan_payments;
CREATE TRIGGER trg_loan_payment_full_paid
AFTER INSERT OR UPDATE ON public.loan_payments
FOR EACH ROW EXECUTE FUNCTION public.update_loan_fully_paid_on();
