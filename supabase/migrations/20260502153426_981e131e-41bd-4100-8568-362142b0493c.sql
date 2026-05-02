-- 1) Rejection log table
CREATE TABLE IF NOT EXISTS public.farmer_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  office_id uuid,
  farmer_id uuid,
  operation text NOT NULL,
  failed_level text NOT NULL,
  reason text NOT NULL,
  attempted jsonb NOT NULL,
  error_message text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_farmer_rejections_created_at ON public.farmer_rejections (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmer_rejections_office ON public.farmer_rejections (office_id);
CREATE INDEX IF NOT EXISTS idx_farmer_rejections_level ON public.farmer_rejections (failed_level);

ALTER TABLE public.farmer_rejections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read farmer_rejections" ON public.farmer_rejections;
CREATE POLICY "admin read farmer_rejections"
  ON public.farmer_rejections
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id IS NULL OR office_id = current_user_office()))
  );

-- 2) SECURITY DEFINER logger (bypasses RLS)
CREATE OR REPLACE FUNCTION public.log_farmer_rejection(
  _user_id uuid, _office_id uuid, _farmer_id uuid,
  _operation text, _failed_level text, _reason text,
  _attempted jsonb, _error_message text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.farmer_rejections
    (user_id, office_id, farmer_id, operation, failed_level, reason, attempted, error_message)
  VALUES
    (_user_id, _office_id, _farmer_id, _operation, _failed_level, _reason, _attempted, _error_message);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_farmer_rejection(uuid,uuid,uuid,text,text,text,jsonb,text) FROM PUBLIC;

-- 3) Validator that LOGS before raising. Uses a single-iteration LOOP so we can EXIT.
CREATE OR REPLACE FUNCTION public.validate_farmer_location_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parent uuid;
  v_level  text;
  v_reason text;
  v_msg    text;
  v_attempted jsonb;
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

    IF NEW.union_id IS NOT NULL THEN
      IF NEW.upazila_id IS NULL THEN
        v_level := 'upazila'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT upazila_id INTO v_parent FROM unions WHERE id = NEW.union_id;
      IF v_parent IS DISTINCT FROM NEW.upazila_id THEN
        v_level := 'union'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF NEW.ward_id IS NOT NULL THEN
      IF NEW.union_id IS NULL THEN
        v_level := 'union'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT union_id INTO v_parent FROM wards WHERE id = NEW.ward_id;
      IF v_parent IS DISTINCT FROM NEW.union_id THEN
        v_level := 'ward'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF NEW.village_id IS NOT NULL THEN
      IF NEW.ward_id IS NULL THEN
        v_level := 'ward'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT ward_id INTO v_parent FROM villages WHERE id = NEW.village_id;
      IF v_parent IS DISTINCT FROM NEW.ward_id THEN
        v_level := 'village'; v_reason := 'mismatch'; EXIT checks;
      END IF;
    END IF;

    IF NEW.mouza_id IS NOT NULL THEN
      IF NEW.union_id IS NULL THEN
        v_level := 'union'; v_reason := 'missing_parent'; EXIT checks;
      END IF;
      SELECT union_id INTO v_parent FROM mouzas WHERE id = NEW.mouza_id;
      IF v_parent IS DISTINCT FROM NEW.union_id THEN
        v_level := 'mouza'; v_reason := 'mismatch'; EXIT checks;
      END IF;
      IF NEW.ward_id IS NOT NULL THEN
        SELECT ward_id INTO v_parent FROM mouzas WHERE id = NEW.mouza_id;
        IF v_parent IS NOT NULL AND v_parent IS DISTINCT FROM NEW.ward_id THEN
          v_level := 'mouza'; v_reason := 'mismatch'; EXIT checks;
        END IF;
      END IF;
    END IF;

    -- All checks passed
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
$$;

DROP TRIGGER IF EXISTS trg_validate_farmer_location ON public.farmers;
CREATE TRIGGER trg_validate_farmer_location
BEFORE INSERT OR UPDATE OF division_id, district_id, upazila_id, union_id, ward_id, village_id, mouza_id
ON public.farmers
FOR EACH ROW EXECUTE FUNCTION public.validate_farmer_location_hierarchy();