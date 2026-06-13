CREATE OR REPLACE FUNCTION public.get_land_billing_split(_land_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(farmer_id uuid, owner_farmer_id uuid, is_borga boolean, billed_area numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _total numeric;
  _allocated numeric := 0;
  _remaining numeric;
  rec record;
BEGIN
  SELECT l.owner_farmer_id, l.land_size INTO _owner, _total FROM public.lands l WHERE l.id = _land_id;
  IF _owner IS NULL THEN
    SELECT l.farmer_id INTO _owner FROM public.lands l WHERE l.id = _land_id;
  END IF;
  _total := COALESCE(_total, 0);

  FOR rec IN
    SELECT lr.sharecropper_farmer_id AS sc,
           COALESCE(lr.area_decimal, _total * COALESCE(lr.share_percentage, 0) / 100.0) AS area
    FROM public.land_relations lr
    WHERE lr.land_id = _land_id
      AND lr.deleted_at IS NULL
      AND lr.sharecropper_farmer_id IS NOT NULL
      AND lr.valid_from <= _as_of
      AND (lr.valid_to IS NULL OR lr.valid_to >= _as_of)
  LOOP
    IF rec.area > 0 THEN
      _allocated := _allocated + rec.area;
      RETURN QUERY SELECT rec.sc, _owner, true, rec.area::numeric;
    END IF;
  END LOOP;

  _remaining := _total - _allocated;
  IF _allocated = 0 OR _remaining > 0.0001 THEN
    RETURN QUERY SELECT _owner, _owner, false, GREATEST(_remaining, 0)::numeric;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_land_billing_split(uuid, date) TO authenticated, service_role;