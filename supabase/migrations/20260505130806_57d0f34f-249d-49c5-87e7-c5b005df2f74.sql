
-- Drop the dependent view first
DROP VIEW IF EXISTS public.lands_with_location;

-- Drop validation triggers / functions
DROP TRIGGER IF EXISTS trg_validate_farmer_location ON public.farmers;
DROP TRIGGER IF EXISTS trg_validate_farmer_locations ON public.farmers;
DROP FUNCTION IF EXISTS public.validate_farmer_location() CASCADE;
DROP FUNCTION IF EXISTS public.validate_farmer_locations() CASCADE;

ALTER TABLE public.farmers
  DROP COLUMN IF EXISTS union_id,
  DROP COLUMN IF EXISTS ward_id,
  DROP COLUMN IF EXISTS mouza_id,
  DROP COLUMN IF EXISTS village_id;

ALTER TABLE public.lands
  DROP COLUMN IF EXISTS mouza_id;

DROP TABLE IF EXISTS public.villages CASCADE;
DROP TABLE IF EXISTS public.mouzas CASCADE;
DROP TABLE IF EXISTS public.wards CASCADE;
DROP TABLE IF EXISTS public.unions CASCADE;

-- Re-create simplified lands view (no union/ward/mouza FK)
CREATE OR REPLACE VIEW public.lands_with_location AS
SELECT l.id, l.farmer_id, l.mouza, l.dag_no, l.land_size, l.owner_type, l.field_type,
       l.created_at, l.office_id,
       NULL::uuid AS division_id, NULL::text AS division_name,
       NULL::uuid AS district_id, NULL::text AS district_name,
       NULL::uuid AS upazila_id, NULL::text AS upazila_name,
       l.mouza AS mouza_name
FROM public.lands l;

-- Voter RPC permissions
REVOKE EXECUTE ON FUNCTION public.cancel_voter_membership(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reactivate_voter_membership(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_voter_membership(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_voter_membership(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_voter_membership(_farmer_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _f record;
  _bal numeric := 0; _loan_due numeric := 0; _irr_due numeric := 0;
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

  SELECT COALESCE(balance, 0) INTO _bal FROM public.farmer_savings_balance WHERE farmer_id = _farmer_id;

  SELECT COALESCE(SUM(GREATEST(COALESCE(l.total_payable,0)
        - COALESCE((SELECT SUM(amount) FROM public.loan_payments lp
                    WHERE lp.loan_id = l.id AND lp.status = 'approved'), 0), 0)), 0)
  INTO _loan_due FROM public.loans l
  WHERE l.farmer_id = _farmer_id AND l.deleted_at IS NULL
    AND l.status NOT IN ('rejected','closed','cancelled');

  SELECT COALESCE(SUM(GREATEST(COALESCE(due_amount,0), 0)), 0) INTO _irr_due
  FROM public.irrigation_charges WHERE farmer_id = _farmer_id AND deleted_at IS NULL;

  IF _bal <> 0 OR _loan_due > 0 OR _irr_due > 0 THEN
    RAISE EXCEPTION 'DUES_BLOCK:%', jsonb_build_object(
      'savings_balance', _bal, 'loan_due', _loan_due, 'irrigation_due', _irr_due
    )::text;
  END IF;

  UPDATE public.farmers
     SET is_voter = false, voter_cancelled_at = now(), voter_cancelled_by = _uid,
         voter_cancel_reason = _reason, voter_reactivated_at = NULL,
         voter_reactivated_by = NULL, voter_reactivate_reason = NULL, updated_at = now()
   WHERE id = _farmer_id;

  INSERT INTO public.voter_audit_logs(
    farmer_id, account_number, voter_number_old, voter_number_new,
    is_voter_old, is_voter_new, changed_by, office_id, note, action
  ) VALUES (_farmer_id, _f.account_number, _f.voter_number, _f.voter_number,
            true, false, _uid, _f.office_id, _reason, 'cancel');

  RETURN jsonb_build_object('ok', true, 'farmer_id', _farmer_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.cancel_voter_membership(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_voter_membership(uuid, text) TO authenticated;

-- Account number generator
CREATE OR REPLACE FUNCTION public.generate_account_number(_office_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _prefix text; _next int; _candidate text; _i int := 0;
BEGIN
  IF _office_id IS NULL THEN _prefix := 'G';
  ELSE
    _prefix := upper(substring(replace((SELECT name FROM offices WHERE id = _office_id), ' ', ''), 1, 2));
    IF _prefix IS NULL OR length(_prefix) < 1 THEN _prefix := 'O'; END IF;
  END IF;
  LOOP
    _i := _i + 1;
    SELECT COALESCE(MAX( CAST(NULLIF(regexp_replace(account_number, '\D', '', 'g'), '') AS int) ), 0) + 1
      INTO _next FROM farmers
     WHERE account_number ILIKE (_prefix || '%')
       AND (_office_id IS NULL OR office_id = _office_id);
    _candidate := _prefix || lpad(_next::text, 4, '0');
    PERFORM 1 FROM farmers WHERE account_number = _candidate;
    IF NOT FOUND THEN RETURN _candidate; END IF;
    IF _i > 50 THEN RAISE EXCEPTION 'Could not generate unique account number'; END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_account_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_account_number(uuid) TO authenticated;

-- Add savings collection types
ALTER TYPE public.savings_txn_type ADD VALUE IF NOT EXISTS 'deposit_collection';
ALTER TYPE public.savings_txn_type ADD VALUE IF NOT EXISTS 'share_collection';
