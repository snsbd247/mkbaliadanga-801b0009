CREATE OR REPLACE FUNCTION public.validate_barga_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parcel_area numeric;
  area_sum numeric;
  pct_sum numeric;
BEGIN
  -- Resolve parcel area for this land (active relations only)
  SELECT COALESCE(land_size, 0) INTO parcel_area
  FROM public.lands WHERE id = NEW.land_id;

  SELECT
    COALESCE(SUM(COALESCE(area_decimal, 0)), 0),
    COALESCE(SUM(COALESCE(share_percentage, 0)), 0)
  INTO area_sum, pct_sum
  FROM public.land_relations
  WHERE land_id = NEW.land_id
    AND deleted_at IS NULL
    AND id <> NEW.id;

  area_sum := area_sum + COALESCE(NEW.area_decimal, 0);
  pct_sum  := pct_sum  + COALESCE(NEW.share_percentage, 0);

  IF NEW.deleted_at IS NULL THEN
    IF parcel_area > 0 AND area_sum - parcel_area > 0.0001 THEN
      RAISE EXCEPTION 'Barga area sum (%) exceeds parcel area (%)', area_sum, parcel_area;
    END IF;
    IF pct_sum - 100 > 0.0001 THEN
      RAISE EXCEPTION 'Barga share percentage sum (%) exceeds 100', pct_sum;
    END IF;
    IF COALESCE(NEW.area_decimal, 0) <= 0 AND COALESCE(NEW.share_percentage, 0) <= 0 THEN
      RAISE EXCEPTION 'Each barga relation must have area_decimal or share_percentage > 0';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_barga_split ON public.land_relations;
CREATE TRIGGER trg_validate_barga_split
BEFORE INSERT OR UPDATE ON public.land_relations
FOR EACH ROW EXECUTE FUNCTION public.validate_barga_split();