
CREATE OR REPLACE FUNCTION public.enforce_irrigation_rate_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.irrigation_rates r
    WHERE r.season_id = NEW.season_id
      AND r.basis = NEW.basis
      AND r.is_active = true
  ) INTO _exists;
  IF NOT _exists THEN
    RAISE EXCEPTION 'IRRIGATION_RATE_MISSING: No active irrigation rate is configured for the selected season + basis. Configure it in Irrigation Rates first.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_irrigation_rate ON public.irrigation_charges;
CREATE TRIGGER trg_enforce_irrigation_rate
BEFORE INSERT OR UPDATE OF season_id, basis
ON public.irrigation_charges
FOR EACH ROW EXECUTE FUNCTION public.enforce_irrigation_rate_exists();

REVOKE EXECUTE ON FUNCTION public.enforce_irrigation_rate_exists() FROM PUBLIC;
