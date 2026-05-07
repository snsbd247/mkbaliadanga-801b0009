
-- Enforce voter (Savings A/C) requirement at DB level for any savings/loan/share writes.
CREATE OR REPLACE FUNCTION public.enforce_farmer_is_voter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_voter boolean;
  v_name text;
BEGIN
  SELECT is_voter, name_en INTO v_is_voter, v_name
  FROM public.farmers WHERE id = NEW.farmer_id;
  IF v_is_voter IS NOT TRUE THEN
    RAISE EXCEPTION
      'Farmer % is not a voter / has no Savings A/C — enable the Voter / Savings Account toggle on the farmer profile before recording %.',
      COALESCE(v_name, NEW.farmer_id::text), TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_voter_savings ON public.savings_transactions;
CREATE TRIGGER trg_enforce_voter_savings
  BEFORE INSERT ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_farmer_is_voter();

DROP TRIGGER IF EXISTS trg_enforce_voter_loans ON public.loans;
CREATE TRIGGER trg_enforce_voter_loans
  BEFORE INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_farmer_is_voter();

DROP TRIGGER IF EXISTS trg_enforce_voter_shares ON public.shares;
CREATE TRIGGER trg_enforce_voter_shares
  BEFORE INSERT ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_farmer_is_voter();

NOTIFY pgrst, 'reload schema';
