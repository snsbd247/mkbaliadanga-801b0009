-- 1) account_number = 5-digit numeric; voter_number mirrors it (single shared number)
CREATE OR REPLACE FUNCTION public.farmers_validate_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_number IS NOT NULL AND NEW.account_number <> '' THEN
    IF NEW.account_number !~ '^[0-9]{5}$' THEN
      RAISE EXCEPTION 'account_number must be 5 digits (got %)', NEW.account_number
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.voter_number IS NOT NULL AND NEW.voter_number <> '' THEN
    IF NEW.voter_number !~ '^[0-9]{5}$' THEN
      RAISE EXCEPTION 'voter_number must be 5 digits (got %)', NEW.voter_number
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Generator now produces a 5-digit number that mirrors farmer_code style.
-- We use farmer_code_seq so account numbers stay in lockstep with farmer codes,
-- but only when account_number was not supplied.
CREATE OR REPLACE FUNCTION public.generate_farmer_account_number(p_office_id uuid, p_created_at timestamp with time zone)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  candidate text;
  attempt int := 0;
  n int;
BEGIN
  LOOP
    n := (floor(random() * 99999))::int + 1;
    candidate := lpad(n::text, 5, '0');
    PERFORM 1 FROM public.farmers WHERE account_number = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 50 THEN
      RAISE EXCEPTION 'Could not generate unique 5-digit account_number';
    END IF;
  END LOOP;
END;
$$;

-- 3) Ensure farmer_code is set BEFORE account_number/voter sync so they can mirror it.
-- Triggers fire alphabetically, so rename the relevant ones with a/z prefixes.
DROP TRIGGER IF EXISTS trg_set_farmer_code ON public.farmers;
CREATE TRIGGER trg_a_set_farmer_code
  BEFORE INSERT ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.set_farmer_code();

DROP TRIGGER IF EXISTS trg_farmers_set_account_number ON public.farmers;
CREATE TRIGGER trg_b_farmers_set_account_number
  BEFORE INSERT ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.farmers_set_account_number();

DROP TRIGGER IF EXISTS trg_farmers_sync_voter_number ON public.farmers;
CREATE TRIGGER trg_c_farmers_sync_voter_number
  BEFORE INSERT OR UPDATE OF voter_number, account_number, is_voter ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.farmers_sync_voter_number();

DROP TRIGGER IF EXISTS trg_farmers_validate_identifiers ON public.farmers;
CREATE TRIGGER trg_d_farmers_validate_identifiers
  BEFORE INSERT OR UPDATE ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.farmers_validate_identifiers();

-- 4) farmers_set_account_number: default to farmer_code (already set by trg_a_*),
-- which guarantees account_number = farmer_code = 5-digit identical value.
CREATE OR REPLACE FUNCTION public.farmers_set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    IF NEW.farmer_code IS NOT NULL AND NEW.farmer_code <> '' THEN
      NEW.account_number := NEW.farmer_code;
    ELSE
      NEW.account_number := public.generate_farmer_account_number(NEW.office_id, NEW.created_at);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Normalize any existing non-5-digit account/voter numbers so future updates don't trip the validator.
-- Strategy: set account_number = farmer_code (which is already 5-digit) for rows that violate the rule.
UPDATE public.farmers
SET account_number = farmer_code
WHERE account_number IS NOT NULL
  AND account_number !~ '^[0-9]{5}$'
  AND farmer_code ~ '^[0-9]{5}$';

UPDATE public.farmers
SET voter_number = account_number
WHERE is_voter = true
  AND voter_number IS DISTINCT FROM account_number
  AND account_number ~ '^[0-9]{5}$';