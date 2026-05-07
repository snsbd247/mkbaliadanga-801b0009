
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS mouza_id   uuid,
  ADD COLUMN IF NOT EXISTS union_id   uuid,
  ADD COLUMN IF NOT EXISTS ward_id    uuid,
  ADD COLUMN IF NOT EXISTS village_id uuid;

CREATE INDEX IF NOT EXISTS idx_farmers_mouza_id ON public.farmers(mouza_id);

CREATE OR REPLACE FUNCTION public.validate_farmer_location_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent uuid;
  v_level  text;
  v_reason text;
  v_msg    text;
  v_attempted jsonb;
  v_has_unions   boolean := to_regclass('public.unions')   IS NOT NULL;
  v_has_wards    boolean := to_regclass('public.wards')    IS NOT NULL;
  v_has_villages boolean := to_regclass('public.villages') IS NOT NULL;
  v_has_mouzas   boolean := to_regclass('public.mouzas')   IS NOT NULL;
BEGIN
  v_attempted := jsonb_build_object(
    'division_id', NEW.division_id, 'district_id', NEW.district_id,
    'upazila_id',  NEW.upazila_id,  'union_id',    NEW.union_id,
    'ward_id',     NEW.ward_id,     'village_id',  NEW.village_id,
    'mouza_id',    NEW.mouza_id,    'name_en',     NEW.name_en
  );

  <<checks>>
  LOOP
    IF NEW.district_id IS NOT NULL THEN
      IF NEW.division_id IS NULL THEN
        v_level := 'division'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT division_id INTO v_parent FROM districts WHERE id = NEW.district_id;
      IF v_parent IS DISTINCT FROM NEW.division_id THEN
        v_level := 'district'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF NEW.upazila_id IS NOT NULL THEN
      IF NEW.district_id IS NULL THEN
        v_level := 'district'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT district_id INTO v_parent FROM upazilas WHERE id = NEW.upazila_id;
      IF v_parent IS DISTINCT FROM NEW.district_id THEN
        v_level := 'upazila'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF v_has_unions AND NEW.union_id IS NOT NULL THEN
      IF NEW.upazila_id IS NULL THEN
        v_level := 'upazila'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      EXECUTE 'SELECT upazila_id FROM public.unions WHERE id = $1' INTO v_parent USING NEW.union_id;
      IF v_parent IS DISTINCT FROM NEW.upazila_id THEN
        v_level := 'union'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF v_has_wards AND NEW.ward_id IS NOT NULL THEN
      IF NEW.union_id IS NULL THEN
        v_level := 'union'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      EXECUTE 'SELECT union_id FROM public.wards WHERE id = $1' INTO v_parent USING NEW.ward_id;
      IF v_parent IS DISTINCT FROM NEW.union_id THEN
        v_level := 'ward'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF v_has_villages AND NEW.village_id IS NOT NULL THEN
      IF NEW.ward_id IS NULL THEN
        v_level := 'ward'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      EXECUTE 'SELECT ward_id FROM public.villages WHERE id = $1' INTO v_parent USING NEW.village_id;
      IF v_parent IS DISTINCT FROM NEW.ward_id THEN
        v_level := 'village'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF v_has_mouzas AND NEW.mouza_id IS NOT NULL THEN
      -- mouzas is parented by upazila in this project
      IF NEW.upazila_id IS NULL THEN
        v_level := 'upazila'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT upazila_id INTO v_parent FROM mouzas WHERE id = NEW.mouza_id;
      IF v_parent IS DISTINCT FROM NEW.upazila_id THEN
        v_level := 'mouza'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    EXIT checks;
  END LOOP;

  IF v_level IS NULL THEN
    RETURN NEW;
  END IF;

  v_msg := 'LOCATION_HIERARCHY_INVALID:' || v_level;
  PERFORM public.log_farmer_rejection(
    auth.uid(),
    NEW.office_id,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END,
    TG_OP,
    v_level,
    v_reason,
    v_attempted,
    v_msg
  );
  RAISE EXCEPTION '%', v_msg USING ERRCODE = '23514';
END;
$function$;

NOTIFY pgrst, 'reload schema';
