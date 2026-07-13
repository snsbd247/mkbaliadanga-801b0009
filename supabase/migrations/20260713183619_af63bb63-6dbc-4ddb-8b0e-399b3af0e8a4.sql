DROP INDEX IF EXISTS public.uq_irrigation_invoices_active_land_season;

CREATE UNIQUE INDEX IF NOT EXISTS uq_irrigation_invoices_active_land_season_farmer
  ON public.irrigation_invoices (season_id, land_id, farmer_id)
  WHERE deleted_at IS NULL AND invoice_status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.get_land_billing_split(_land_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(farmer_id uuid, owner_farmer_id uuid, is_borga boolean, billed_area numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _total numeric;
  _allocated numeric := 0;
  _remaining numeric;
  rec record;
BEGIN
  SELECT COALESCE(l.owner_farmer_id, l.farmer_id), COALESCE(l.land_size, l.area_decimal, 0)
    INTO _owner, _total
  FROM public.lands l
  WHERE l.id = _land_id;

  IF _owner IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      lr.sharecropper_farmer_id AS sc,
      COALESCE(
        NULLIF(lr.area_decimal, 0),
        (_total * COALESCE(NULLIF(lr.share_percentage, 0), 0) / 100.0)
      ) AS area
    FROM public.land_relations lr
    WHERE lr.land_id = _land_id
      AND lr.deleted_at IS NULL
      AND lr.sharecropper_farmer_id IS NOT NULL
      AND (lr.valid_from IS NULL OR lr.valid_from <= _as_of)
      AND (lr.valid_to IS NULL OR lr.valid_to >= _as_of)
    ORDER BY lr.valid_from NULLS FIRST, lr.created_at NULLS FIRST, lr.id
  LOOP
    IF rec.area > 0 THEN
      _allocated := _allocated + rec.area;
      RETURN QUERY SELECT rec.sc, _owner, true, rec.area::numeric;
    END IF;
  END LOOP;

  _remaining := COALESCE(_total, 0) - _allocated;
  IF _allocated = 0 OR _remaining > 0.0001 THEN
    RETURN QUERY SELECT _owner, _owner, false, GREATEST(_remaining, 0)::numeric;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_land_billing_split(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_land_billing_split(uuid, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';