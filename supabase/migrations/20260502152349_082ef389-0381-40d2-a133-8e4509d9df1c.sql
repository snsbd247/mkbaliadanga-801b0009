CREATE OR REPLACE FUNCTION public.validate_farmer_location_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parent uuid;
BEGIN
  -- district must belong to division (when both set)
  IF NEW.district_id IS NOT NULL THEN
    IF NEW.division_id IS NULL THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:division' USING ERRCODE = '23514';
    END IF;
    SELECT division_id INTO v_parent FROM districts WHERE id = NEW.district_id;
    IF v_parent IS DISTINCT FROM NEW.division_id THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:district' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- upazila must belong to district
  IF NEW.upazila_id IS NOT NULL THEN
    IF NEW.district_id IS NULL THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:district' USING ERRCODE = '23514';
    END IF;
    SELECT district_id INTO v_parent FROM upazilas WHERE id = NEW.upazila_id;
    IF v_parent IS DISTINCT FROM NEW.district_id THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:upazila' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- union must belong to upazila
  IF NEW.union_id IS NOT NULL THEN
    IF NEW.upazila_id IS NULL THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:upazila' USING ERRCODE = '23514';
    END IF;
    SELECT upazila_id INTO v_parent FROM unions WHERE id = NEW.union_id;
    IF v_parent IS DISTINCT FROM NEW.upazila_id THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:union' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- ward must belong to union
  IF NEW.ward_id IS NOT NULL THEN
    IF NEW.union_id IS NULL THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:union' USING ERRCODE = '23514';
    END IF;
    SELECT union_id INTO v_parent FROM wards WHERE id = NEW.ward_id;
    IF v_parent IS DISTINCT FROM NEW.union_id THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:ward' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- village must belong to ward (and union)
  IF NEW.village_id IS NOT NULL THEN
    IF NEW.ward_id IS NULL THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:ward' USING ERRCODE = '23514';
    END IF;
    SELECT ward_id INTO v_parent FROM villages WHERE id = NEW.village_id;
    IF v_parent IS DISTINCT FROM NEW.ward_id THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:village' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- mouza must belong to union (and ward if both set)
  IF NEW.mouza_id IS NOT NULL THEN
    IF NEW.union_id IS NULL THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:union' USING ERRCODE = '23514';
    END IF;
    SELECT union_id INTO v_parent FROM mouzas WHERE id = NEW.mouza_id;
    IF v_parent IS DISTINCT FROM NEW.union_id THEN
      RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:mouza' USING ERRCODE = '23514';
    END IF;
    IF NEW.ward_id IS NOT NULL THEN
      SELECT ward_id INTO v_parent FROM mouzas WHERE id = NEW.mouza_id;
      IF v_parent IS NOT NULL AND v_parent IS DISTINCT FROM NEW.ward_id THEN
        RAISE EXCEPTION 'LOCATION_HIERARCHY_INVALID:mouza' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_farmer_location ON public.farmers;
CREATE TRIGGER trg_validate_farmer_location
BEFORE INSERT OR UPDATE OF division_id, district_id, upazila_id, union_id, ward_id, village_id, mouza_id
ON public.farmers
FOR EACH ROW EXECUTE FUNCTION public.validate_farmer_location_hierarchy();