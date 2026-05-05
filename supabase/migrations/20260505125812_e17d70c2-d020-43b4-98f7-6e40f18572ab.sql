
-- 1. Add cancel/reactivate tracking columns
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS voter_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS voter_cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS voter_cancel_reason text,
  ADD COLUMN IF NOT EXISTS voter_reactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS voter_reactivated_by uuid,
  ADD COLUMN IF NOT EXISTS voter_reactivate_reason text;

-- 2. Add note column to voter audit log
ALTER TABLE public.voter_audit_logs
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS action text;

-- 3. RPC: cancel voter membership (super admin only)
CREATE OR REPLACE FUNCTION public.cancel_voter_membership(
  _farmer_id uuid,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _f record;
  _bal numeric := 0;
  _loan_due numeric := 0;
  _irr_due numeric := 0;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can cancel voter membership';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A cancellation reason (min 3 chars) is required';
  END IF;

  SELECT * INTO _f FROM public.farmers WHERE id = _farmer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;
  IF NOT _f.is_voter THEN RAISE EXCEPTION 'Farmer is not currently an active voter'; END IF;

  -- Savings balance
  SELECT COALESCE(balance, 0) INTO _bal
  FROM public.farmer_savings_balance WHERE farmer_id = _farmer_id;

  -- Loan due
  SELECT COALESCE(SUM(GREATEST(COALESCE(l.total_payable,0)
        - COALESCE((SELECT SUM(amount) FROM public.loan_payments lp
                    WHERE lp.loan_id = l.id AND lp.status = 'approved'), 0), 0)), 0)
  INTO _loan_due
  FROM public.loans l
  WHERE l.farmer_id = _farmer_id
    AND l.deleted_at IS NULL
    AND l.status NOT IN ('rejected','closed','cancelled');

  -- Irrigation due
  SELECT COALESCE(SUM(GREATEST(COALESCE(due_amount,0), 0)), 0)
  INTO _irr_due
  FROM public.irrigation_charges
  WHERE farmer_id = _farmer_id AND deleted_at IS NULL;

  IF _bal <> 0 OR _loan_due > 0 OR _irr_due > 0 THEN
    RAISE EXCEPTION 'Cannot cancel: outstanding balances. Savings: %, Loan due: %, Irrigation due: %',
      _bal, _loan_due, _irr_due;
  END IF;

  UPDATE public.farmers
     SET is_voter = false,
         voter_cancelled_at = now(),
         voter_cancelled_by = _uid,
         voter_cancel_reason = _reason,
         voter_reactivated_at = NULL,
         voter_reactivated_by = NULL,
         voter_reactivate_reason = NULL,
         updated_at = now()
   WHERE id = _farmer_id;

  INSERT INTO public.voter_audit_logs(
    farmer_id, account_number, voter_number_old, voter_number_new,
    is_voter_old, is_voter_new, changed_by, office_id, note, action
  ) VALUES (
    _farmer_id, _f.account_number, _f.voter_number, _f.voter_number,
    true, false, _uid, _f.office_id, _reason, 'cancel'
  );

  RETURN jsonb_build_object('ok', true, 'farmer_id', _farmer_id);
END $$;

-- 4. RPC: reactivate voter membership
CREATE OR REPLACE FUNCTION public.reactivate_voter_membership(
  _farmer_id uuid,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _f record;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can reactivate voter membership';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A reactivation reason (min 3 chars) is required';
  END IF;

  SELECT * INTO _f FROM public.farmers WHERE id = _farmer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;
  IF _f.is_voter THEN RAISE EXCEPTION 'Farmer is already an active voter'; END IF;
  IF _f.voter_number IS NULL OR length(_f.voter_number) = 0 THEN
    RAISE EXCEPTION 'Farmer has no voter number assigned';
  END IF;

  UPDATE public.farmers
     SET is_voter = true,
         voter_reactivated_at = now(),
         voter_reactivated_by = _uid,
         voter_reactivate_reason = _reason,
         updated_at = now()
   WHERE id = _farmer_id;

  INSERT INTO public.voter_audit_logs(
    farmer_id, account_number, voter_number_old, voter_number_new,
    is_voter_old, is_voter_new, changed_by, office_id, note, action
  ) VALUES (
    _farmer_id, _f.account_number, _f.voter_number, _f.voter_number,
    false, true, _uid, _f.office_id, _reason, 'reactivate'
  );

  RETURN jsonb_build_object('ok', true, 'farmer_id', _farmer_id);
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_voter_membership(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_voter_membership(uuid, text) TO authenticated;
