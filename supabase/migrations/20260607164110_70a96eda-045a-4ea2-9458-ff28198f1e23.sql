-- 1) Merge-tracking columns
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.farmers(id),
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

-- 2) Enforce: inactive farmers cannot receive NEW invoices / savings txns
CREATE OR REPLACE FUNCTION public.block_txn_for_inactive_farmer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
BEGIN
  SELECT status INTO _status FROM public.farmers WHERE id = NEW.farmer_id;
  IF _status = 'inactive' THEN
    RAISE EXCEPTION 'Farmer is inactive — new entries are not allowed for inactive farmers.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_inactive_irrigation_invoice ON public.irrigation_invoices;
CREATE TRIGGER trg_block_inactive_irrigation_invoice
  BEFORE INSERT ON public.irrigation_invoices
  FOR EACH ROW EXECUTE FUNCTION public.block_txn_for_inactive_farmer();

DROP TRIGGER IF EXISTS trg_block_inactive_savings_txn ON public.savings_transactions;
CREATE TRIGGER trg_block_inactive_savings_txn
  BEFORE INSERT ON public.savings_transactions
  FOR EACH ROW EXECUTE FUNCTION public.block_txn_for_inactive_farmer();

-- 3) Admin-only farmer merge
CREATE OR REPLACE FUNCTION public.merge_farmers(_source uuid, _target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _src_office uuid;
  _src_code text;
  _tgt_code text;
BEGIN
  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'Only admins can merge farmers.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _source = _target THEN
    RAISE EXCEPTION 'Source and target must be different farmers.';
  END IF;

  SELECT office_id, farmer_code INTO _src_office, _src_code FROM public.farmers WHERE id = _source;
  IF _src_office IS NULL AND _src_code IS NULL THEN
    RAISE EXCEPTION 'Source farmer not found.';
  END IF;
  SELECT farmer_code INTO _tgt_code FROM public.farmers WHERE id = _target;
  IF _tgt_code IS NULL THEN
    RAISE EXCEPTION 'Target farmer not found.';
  END IF;

  -- Reassign all related records from source -> target
  UPDATE public.savings_transactions   SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.farmer_savings_plans    SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.savings_yearly_opening  SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.shares                  SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.lands                   SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.lands                   SET owner_farmer_id = _target WHERE owner_farmer_id = _source;
  UPDATE public.irrigation_invoices     SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.irrigation_invoices     SET owner_farmer_id = _target WHERE owner_farmer_id = _source;
  UPDATE public.irrigation_charges      SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.irrigation_due_promises SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.payments                SET farmer_id = _target WHERE farmer_id = _source;
  UPDATE public.land_relations          SET owner_farmer_id = _target WHERE owner_farmer_id = _source;
  UPDATE public.farmer_notes            SET farmer_id = _target WHERE farmer_id = _source;

  -- Mark source as merged + inactive
  UPDATE public.farmers
     SET status = 'inactive', merged_into = _target, merged_at = now(), merged_by = _uid
   WHERE id = _source;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, office_id, old_values, new_values)
  VALUES (
    _uid, 'farmer_merge', 'farmers', _source, _src_office,
    jsonb_build_object('source_farmer', _source, 'source_code', _src_code),
    jsonb_build_object('target_farmer', _target, 'target_code', _tgt_code)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_farmers(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_farmers(uuid, uuid) TO authenticated;
