-- Trigger: keep voter_number = account_number when is_voter, NULL otherwise
CREATE OR REPLACE FUNCTION public.farmers_sync_voter_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_voter, false) THEN
    -- Voter: voter_number must mirror account_number
    IF NEW.account_number IS NULL OR length(trim(NEW.account_number)) = 0 THEN
      -- If voter_number was explicitly given, promote it
      IF NEW.voter_number IS NOT NULL AND length(trim(NEW.voter_number)) > 0 THEN
        NEW.account_number := NEW.voter_number;
      END IF;
    END IF;
    NEW.voter_number := NEW.account_number;
  ELSE
    NEW.voter_number := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farmers_sync_voter_number ON public.farmers;
CREATE TRIGGER trg_farmers_sync_voter_number
BEFORE INSERT OR UPDATE OF voter_number, account_number, is_voter
ON public.farmers
FOR EACH ROW EXECUTE FUNCTION public.farmers_sync_voter_number();

-- Backfill any existing divergence
UPDATE public.farmers
SET voter_number = CASE WHEN is_voter THEN account_number ELSE NULL END
WHERE (is_voter AND voter_number IS DISTINCT FROM account_number)
   OR (NOT is_voter AND voter_number IS NOT NULL);