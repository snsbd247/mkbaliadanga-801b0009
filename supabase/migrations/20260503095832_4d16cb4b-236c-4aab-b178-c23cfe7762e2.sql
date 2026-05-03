-- Add optional note to loan_payments and flow user-entered note into ledger_entries.description
ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS note text;

-- Savings: prefer the user-entered note for the description, with safe defaults
CREATE OR REPLACE FUNCTION public.post_savings_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cash uuid; payable uuid; v_desc text;
BEGIN
  cash    := public._acct('1010');
  payable := public._acct('2010');
  IF TG_OP = 'DELETE' THEN
    PERFORM public._clear_ref('savings', OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public._clear_ref('savings', NEW.id);
  IF NEW.status = 'approved' THEN
    IF NEW.type = 'deposit' THEN
      v_desc := COALESCE(NULLIF(btrim(NEW.note), ''), 'Savings deposit');
      PERFORM public._post_pair(NEW.txn_date, cash, payable, NEW.amount,
        'savings', NEW.id, v_desc, NEW.office_id, NEW.created_by);
    ELSIF NEW.type = 'withdraw' THEN
      v_desc := COALESCE(NULLIF(btrim(NEW.note), ''), 'Savings withdrawal');
      PERFORM public._post_pair(NEW.txn_date, payable, cash, NEW.amount,
        'savings', NEW.id, v_desc, NEW.office_id, NEW.created_by);
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Loan disbursement: use loans.note when provided
CREATE OR REPLACE FUNCTION public.post_loan_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cash uuid; receivable uuid; v_desc text;
BEGIN
  cash       := public._acct('1010');
  receivable := public._acct('1040');
  IF TG_OP = 'DELETE' THEN
    PERFORM public._clear_ref('loan', OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public._clear_ref('loan', NEW.id);
  IF NEW.status IN ('approved','paid') THEN
    v_desc := COALESCE(NULLIF(btrim(NEW.note), ''), 'Loan disbursed');
    PERFORM public._post_pair(NEW.issued_on, receivable, cash, NEW.principal,
      'loan', NEW.id, v_desc, NEW.office_id, NEW.created_by);
  END IF;
  RETURN NEW;
END $$;

-- Loan payment: use loan_payments.note (falls back to approval_note, then default)
CREATE OR REPLACE FUNCTION public.post_loan_payment_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cash uuid; receivable uuid; v_desc text;
BEGIN
  cash       := public._acct('1010');
  receivable := public._acct('1040');
  IF TG_OP = 'DELETE' THEN
    PERFORM public._clear_ref('loan_payment', OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public._clear_ref('loan_payment', NEW.id);
  IF NEW.status IS NULL OR NEW.status = 'approved' THEN
    v_desc := COALESCE(
      NULLIF(btrim(NEW.note), ''),
      NULLIF(btrim(NEW.approval_note), ''),
      'Loan repayment'
    );
    PERFORM public._post_pair(NEW.paid_on, cash, receivable, NEW.amount,
      'loan_payment', NEW.id, v_desc, NEW.office_id, NEW.collected_by);
  END IF;
  RETURN NEW;
END $$;