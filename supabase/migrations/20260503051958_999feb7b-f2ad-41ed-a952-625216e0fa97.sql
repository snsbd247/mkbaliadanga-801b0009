CREATE OR REPLACE FUNCTION public.validate_farmer_locations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.division_id IS NULL
     OR NEW.district_id IS NULL
     OR NEW.upazila_id IS NULL
     OR NEW.union_id   IS NULL
     OR NEW.ward_id    IS NULL
     OR NEW.village_id IS NULL
     OR NEW.mouza_id   IS NULL THEN
    RAISE EXCEPTION 'All location levels (division, district, upazila, union, ward, village, mouza) are required for farmer'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_farmer_locations ON public.farmers;
CREATE TRIGGER trg_validate_farmer_locations
BEFORE INSERT OR UPDATE OF division_id, district_id, upazila_id, union_id, ward_id, village_id, mouza_id
ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.validate_farmer_locations();