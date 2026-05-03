-- voter_number column
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS voter_number text;

-- Unique only when not null/empty
CREATE UNIQUE INDEX IF NOT EXISTS farmers_voter_number_key
  ON public.farmers (voter_number)
  WHERE voter_number IS NOT NULL AND voter_number <> '';

-- Validation trigger: account_number must be 12-14 digits; voter_number digits-only when present
CREATE OR REPLACE FUNCTION public.farmers_validate_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NOT NULL AND NEW.account_number <> '' THEN
    IF NEW.account_number !~ '^[0-9]{12,14}$' THEN
      RAISE EXCEPTION 'account_number must be 12 to 14 digits (got %)', NEW.account_number
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.voter_number IS NOT NULL AND NEW.voter_number <> '' THEN
    IF NEW.voter_number !~ '^[0-9]{1,20}$' THEN
      RAISE EXCEPTION 'voter_number must be numeric (got %)', NEW.voter_number
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farmers_validate_identifiers ON public.farmers;
CREATE TRIGGER trg_farmers_validate_identifiers
  BEFORE INSERT OR UPDATE ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.farmers_validate_identifiers();