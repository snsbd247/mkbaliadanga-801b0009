
-- 1. Add 'profit' value to savings type enum (idempotent)
ALTER TYPE savings_txn_type ADD VALUE IF NOT EXISTS 'profit';

-- 2. Field receipt # column
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS field_receipt_no text;

-- 3. Withdrawal balance-guard trigger
CREATE OR REPLACE FUNCTION public.savings_check_withdraw_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
BEGIN
  -- only enforce on inserts of withdraw (or update that changes amount/type to withdraw)
  IF NEW.type <> 'withdraw' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('deposit','deposit_collection','profit') THEN amount
      WHEN type = 'withdraw' THEN -amount
      ELSE 0
    END
  ),0) INTO v_balance
  FROM public.savings_transactions
  WHERE farmer_id = NEW.farmer_id
    AND status = 'approved'
    AND deleted_at IS NULL
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF NEW.amount > v_balance THEN
    RAISE EXCEPTION 'SAVINGS_WITHDRAW_EXCEEDS_BALANCE: requested % > available %', NEW.amount, v_balance
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_savings_check_withdraw ON public.savings_transactions;
CREATE TRIGGER trg_savings_check_withdraw
BEFORE INSERT OR UPDATE OF amount, type, status ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.savings_check_withdraw_balance();
