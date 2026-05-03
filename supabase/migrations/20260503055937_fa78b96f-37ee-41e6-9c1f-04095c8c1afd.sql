-- 1) Add unique account_number column to farmers
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS account_number text;

-- Backfill from farmer_code where missing
UPDATE public.farmers SET account_number = farmer_code WHERE account_number IS NULL;

-- Unique index (allows multiple NULLs but our backfill removes them)
CREATE UNIQUE INDEX IF NOT EXISTS farmers_account_number_key ON public.farmers(account_number);

-- Generator: YYMM + last 4 hex of office_id + 5-digit random; collision-checked
CREATE OR REPLACE FUNCTION public.generate_farmer_account_number(p_office_id uuid, p_created_at timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yymm text := to_char(coalesce(p_created_at, now()), 'YYMM');
  office_part text := upper(substr(replace(coalesce(p_office_id::text, '0000'), '-', ''), 1, 4));
  rand_part text;
  candidate text;
  attempt int := 0;
BEGIN
  LOOP
    rand_part := lpad((floor(random() * 100000))::int::text, 5, '0');
    candidate := yymm || office_part || rand_part;
    PERFORM 1 FROM public.farmers WHERE account_number = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 20 THEN
      RAISE EXCEPTION 'Could not generate unique account_number';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.farmers_set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := public.generate_farmer_account_number(NEW.office_id, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farmers_set_account_number ON public.farmers;
CREATE TRIGGER trg_farmers_set_account_number
  BEFORE INSERT ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.farmers_set_account_number();

-- 2) Lands-with-location view (security_invoker so existing RLS applies)
DROP VIEW IF EXISTS public.lands_with_location;
CREATE VIEW public.lands_with_location
WITH (security_invoker = on) AS
SELECT
  l.*,
  div.id   AS division_id,   div.name AS division_name,
  dis.id   AS district_id,   dis.name AS district_name,
  upa.id   AS upazila_id,    upa.name AS upazila_name,
  un.id    AS union_id,      un.name  AS union_name,
  w.id     AS ward_id,       w.name   AS ward_name,
  v.id     AS village_id,    v.name   AS village_name,
  m.name   AS mouza_name
FROM public.lands l
LEFT JOIN public.mouzas m   ON m.id = l.mouza_id
LEFT JOIN public.villages v ON v.ward_id = m.ward_id
LEFT JOIN public.wards w    ON w.id = m.ward_id
LEFT JOIN public.unions un  ON un.id = COALESCE(w.union_id, m.union_id)
LEFT JOIN public.upazilas upa ON upa.id = un.upazila_id
LEFT JOIN public.districts dis ON dis.id = upa.district_id
LEFT JOIN public.divisions div ON div.id = dis.division_id;
