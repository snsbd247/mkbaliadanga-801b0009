CREATE OR REPLACE FUNCTION public.validate_office_income()
RETURNS TRIGGER AS $$
BEGIN
  NEW.payer_name := NULLIF(btrim(NEW.payer_name), '');
  NEW.father_name := NULLIF(btrim(NEW.father_name), '');
  NEW.village := NULLIF(btrim(NEW.village), '');
  NEW.mobile := NULLIF(btrim(NEW.mobile), '');

  IF NEW.payer_name IS NULL THEN
    RAISE EXCEPTION 'payer_name is required';
  END IF;
  IF char_length(NEW.payer_name) > 100 THEN
    RAISE EXCEPTION 'payer_name too long (max 100)';
  END IF;
  IF NEW.father_name IS NOT NULL AND char_length(NEW.father_name) > 100 THEN
    RAISE EXCEPTION 'father_name too long (max 100)';
  END IF;
  IF NEW.village IS NOT NULL AND char_length(NEW.village) > 100 THEN
    RAISE EXCEPTION 'village too long (max 100)';
  END IF;
  IF NEW.mobile IS NOT NULL AND NEW.mobile !~ '^[0-9+\-\s]{6,20}$' THEN
    RAISE EXCEPTION 'mobile format invalid';
  END IF;
  IF COALESCE(NEW.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than 0';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_office_income ON public.office_incomes;
CREATE TRIGGER trg_validate_office_income
  BEFORE INSERT OR UPDATE ON public.office_incomes
  FOR EACH ROW EXECUTE FUNCTION public.validate_office_income();