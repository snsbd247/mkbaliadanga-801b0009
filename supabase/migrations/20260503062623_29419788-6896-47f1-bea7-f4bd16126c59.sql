-- Replace generator with all-digits output (13 chars)
CREATE OR REPLACE FUNCTION public.generate_farmer_account_number(p_office_id uuid, p_created_at timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yymm text := to_char(coalesce(p_created_at, now()), 'YYMM');
  office_part text;
  rand_part text;
  candidate text;
  attempt int := 0;
BEGIN
  -- Deterministic 4-digit numeric office hash
  office_part := lpad(((abs(hashtext(coalesce(p_office_id::text, 'global'))) % 10000))::text, 4, '0');
  LOOP
    rand_part := lpad((floor(random() * 100000))::int::text, 5, '0');
    candidate := yymm || office_part || rand_part; -- 13 digits
    PERFORM 1 FROM public.farmers WHERE account_number = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 30 THEN
      RAISE EXCEPTION 'Could not generate unique account_number';
    END IF;
  END LOOP;
END;
$$;

-- Backfill any existing rows whose account_number doesn't match the new format
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, office_id, created_at
    FROM public.farmers
    WHERE account_number IS NULL
       OR account_number !~ '^[0-9]{12,14}$'
  LOOP
    UPDATE public.farmers
       SET account_number = public.generate_farmer_account_number(r.office_id, r.created_at)
     WHERE id = r.id;
  END LOOP;
END $$;