DROP FUNCTION IF EXISTS public.merge_farmers(uuid, uuid);

CREATE OR REPLACE FUNCTION public.merge_farmers(_source uuid, _target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  uid uuid := auth.uid();
  _office uuid;
  c_lands int; c_irrigation int; c_savings int; c_loans int; c_payments int;
  leftover int;
  counts jsonb;
BEGIN
  IF _source IS NULL OR _target IS NULL THEN
    RAISE EXCEPTION 'Source and target are required';
  END IF;
  IF _source = _target THEN
    RAISE EXCEPTION 'Source and target must be different farmers';
  END IF;

  IF NOT (
    public.has_role(uid, 'admin')
    OR public.has_role(uid, 'super_admin')
    OR public.has_role(uid, 'developer')
  ) THEN
    RAISE EXCEPTION 'Only administrators can merge farmers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.farmers WHERE id = _source) THEN
    RAISE EXCEPTION 'Source farmer not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.farmers WHERE id = _target) THEN
    RAISE EXCEPTION 'Target farmer not found';
  END IF;

  SELECT count(*) INTO c_lands FROM public.lands WHERE farmer_id = _source;
  SELECT count(*) INTO c_irrigation FROM public.irrigation_invoices WHERE farmer_id = _source;
  SELECT count(*) INTO c_savings FROM public.savings_transactions WHERE farmer_id = _source;
  SELECT count(*) INTO c_loans FROM public.loans WHERE farmer_id = _source;
  SELECT count(*) INTO c_payments FROM public.payments WHERE farmer_id = _source;

  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'farmer_id'
      AND table_name <> 'farmers'
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET farmer_id = $1 WHERE farmer_id = $2',
      r.table_name
    ) USING _target, _source;
  END LOOP;

  SELECT
    (SELECT count(*) FROM public.lands WHERE farmer_id = _source)
    + (SELECT count(*) FROM public.irrigation_invoices WHERE farmer_id = _source)
    + (SELECT count(*) FROM public.savings_transactions WHERE farmer_id = _source)
    + (SELECT count(*) FROM public.loans WHERE farmer_id = _source)
    + (SELECT count(*) FROM public.payments WHERE farmer_id = _source)
  INTO leftover;

  IF leftover <> 0 THEN
    RAISE EXCEPTION 'Merge verification failed: % records still linked to the source farmer', leftover;
  END IF;

  UPDATE public.farmers
  SET status = 'inactive',
      merged_into = _target,
      merged_at = now(),
      merged_by = uid,
      updated_at = now()
  WHERE id = _source;

  SELECT office_id INTO _office FROM public.farmers WHERE id = _target;

  counts := jsonb_build_object(
    'lands', c_lands,
    'irrigation', c_irrigation,
    'savings', c_savings,
    'loans', c_loans,
    'payments', c_payments
  );

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, office_id, meta)
  VALUES (
    uid,
    'farmer.merge',
    'farmer',
    _source,
    _office,
    jsonb_build_object(
      'kept_farmer', _target,
      'duplicate_farmer', _source,
      'office_id', _office,
      'merged_at', now(),
      'moved_counts', counts
    )
  );

  RETURN jsonb_build_object('ok', true, 'moved_counts', counts);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_farmers(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_farmers(uuid, uuid) TO authenticated, service_role;