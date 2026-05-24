CREATE OR REPLACE FUNCTION public.farmers_set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Farmer ID is the single source of truth for savings account number.
  -- This prevents clients/imports from supplying a different account number.
  IF NEW.farmer_code IS NULL OR length(trim(NEW.farmer_code)) = 0 THEN
    NEW.farmer_code := public.generate_farmer_account_number(NEW.office_id, COALESCE(NEW.created_at, now()));
  END IF;

  NEW.account_number := NEW.farmer_code;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.farmers_sync_voter_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Voter number mirrors the same 5-digit account/farmer identifier for voters.
  -- Non-voters do not keep a voter number.
  IF COALESCE(NEW.is_voter, false) THEN
    NEW.voter_number := NEW.account_number;
  ELSE
    NEW.voter_number := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_farmer_account_number(p_office_id uuid, p_created_at timestamp with time zone)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
  attempt int := 0;
  n int;
BEGIN
  LOOP
    n := (floor(random() * 99999))::int + 1;
    candidate := lpad(n::text, 5, '0');

    PERFORM 1
    FROM public.farmers
    WHERE farmer_code = candidate
       OR account_number = candidate
       OR voter_number = candidate;

    IF NOT FOUND THEN
      RETURN candidate;
    END IF;

    attempt := attempt + 1;
    IF attempt > 250 THEN
      RAISE EXCEPTION 'Could not generate unique 5-digit farmer identifier';
    END IF;
  END LOOP;
END;
$function$;

DROP TRIGGER IF EXISTS trg_b_farmers_set_account_number ON public.farmers;
CREATE TRIGGER trg_b_farmers_set_account_number
BEFORE INSERT OR UPDATE OF farmer_code, account_number ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.farmers_set_account_number();

DROP TRIGGER IF EXISTS trg_c_farmers_sync_voter_number ON public.farmers;
CREATE TRIGGER trg_c_farmers_sync_voter_number
BEFORE INSERT OR UPDATE OF voter_number, account_number, is_voter, farmer_code ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.farmers_sync_voter_number();