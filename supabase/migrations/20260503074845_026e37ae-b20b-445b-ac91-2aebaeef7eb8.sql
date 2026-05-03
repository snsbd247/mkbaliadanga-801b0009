
-- Add is_voter flag, keep voter_number immutable
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS is_voter boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS farmers_is_voter_idx ON public.farmers (is_voter) WHERE is_voter = true;

-- Backfill is_voter for existing farmers that already have a voter_number
UPDATE public.farmers
   SET is_voter = true
 WHERE is_voter = false
   AND voter_number IS NOT NULL
   AND voter_number <> '';

-- Immutability trigger: once voter_number is assigned, it cannot be changed or cleared
CREATE OR REPLACE FUNCTION public.enforce_voter_number_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.voter_number IS NOT NULL AND OLD.voter_number <> '' THEN
    IF NEW.voter_number IS DISTINCT FROM OLD.voter_number THEN
      -- Silently preserve the original voter_number instead of erroring,
      -- so client-side updates that resend the row don't break.
      NEW.voter_number := OLD.voter_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farmers_voter_number_immutable ON public.farmers;
CREATE TRIGGER trg_farmers_voter_number_immutable
BEFORE UPDATE ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_voter_number_immutability();
