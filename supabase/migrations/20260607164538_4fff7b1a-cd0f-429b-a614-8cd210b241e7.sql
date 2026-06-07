ALTER TABLE public.land_relations
  ADD COLUMN IF NOT EXISTS area_decimal numeric;

ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS remarks text;

-- Guard: total active borga area on a parcel must not exceed parcel size
CREATE OR REPLACE FUNCTION public.check_borga_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _land_size numeric;
  _allocated numeric;
BEGIN
  IF NEW.area_decimal IS NULL OR NEW.deleted_at IS NOT NULL OR NEW.valid_to IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT land_size INTO _land_size FROM public.lands WHERE id = NEW.land_id;
  IF _land_size IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(area_decimal), 0) INTO _allocated
  FROM public.land_relations
  WHERE land_id = NEW.land_id
    AND deleted_at IS NULL
    AND valid_to IS NULL
    AND area_decimal IS NOT NULL
    AND id <> NEW.id;

  IF (_allocated + NEW.area_decimal) > _land_size THEN
    RAISE EXCEPTION 'Total borga area (%) exceeds the parcel size (%).', (_allocated + NEW.area_decimal), _land_size
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_borga_allocation ON public.land_relations;
CREATE TRIGGER trg_check_borga_allocation
  BEFORE INSERT OR UPDATE ON public.land_relations
  FOR EACH ROW EXECUTE FUNCTION public.check_borga_allocation();
