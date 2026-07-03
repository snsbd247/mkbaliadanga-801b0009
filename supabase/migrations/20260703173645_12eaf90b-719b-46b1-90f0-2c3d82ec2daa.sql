CREATE OR REPLACE FUNCTION public.merge_farmers(_source uuid, _target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  uid uuid := auth.uid();
BEGIN
  IF _source IS NULL OR _target IS NULL THEN
    RAISE EXCEPTION 'Source and target are required';
  END IF;
  IF _source = _target THEN
    RAISE EXCEPTION 'Source and target must be different farmers';
  END IF;

  -- Only admins may merge.
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

  -- Repoint every public table that references farmer_id (except farmers itself).
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

  -- Mark the source farmer as merged / inactive.
  UPDATE public.farmers
  SET status = 'inactive',
      merged_into = _target,
      merged_at = now(),
      merged_by = uid,
      updated_at = now()
  WHERE id = _source;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_farmers(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_farmers(uuid, uuid) TO authenticated, service_role;