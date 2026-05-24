CREATE OR REPLACE FUNCTION public.enforce_voter_number_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- The unified 5-digit Farmer ID/account number is the source of truth.
  -- Keep voter_number synced instead of preserving an older separate value.
  IF COALESCE(NEW.is_voter, false) THEN
    NEW.voter_number := NEW.account_number;
  ELSE
    NEW.voter_number := NULL;
  END IF;
  RETURN NEW;
END;
$function$;