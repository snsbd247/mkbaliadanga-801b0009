
-- Dedupe irrigation_rates by (office_id, season_id) before backfilling office_id.
WITH default_office AS (
  SELECT id FROM public.offices ORDER BY created_at LIMIT 1
),
ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY COALESCE(office_id, (SELECT id FROM default_office)), season_id
           ORDER BY created_at DESC
         ) AS rn
  FROM public.irrigation_rates
)
DELETE FROM public.irrigation_rates r
USING ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

UPDATE public.irrigation_rates
SET office_id = (SELECT id FROM public.offices ORDER BY created_at LIMIT 1)
WHERE office_id IS NULL;

UPDATE public.profiles p
SET office_id = (SELECT id FROM public.offices ORDER BY created_at LIMIT 1)
WHERE p.office_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p.id
      AND r.role IN ('super_admin'::app_role, 'developer'::app_role, 'admin'::app_role)
  );

-- Receipt counters table + RPC.
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  kind  TEXT NOT NULL,
  year  INT  NOT NULL,
  last_no BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, year)
);

ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read receipt counters" ON public.receipt_counters;
CREATE POLICY "auth read receipt counters"
  ON public.receipt_counters FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_receipt_no(p_kind TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_kind TEXT := upper(coalesce(p_kind, 'PAY'));
  v_no   BIGINT;
BEGIN
  IF v_kind NOT IN ('PAY','IRR','SAV','LOAN') THEN
    v_kind := 'PAY';
  END IF;

  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES (v_kind, v_year, 1, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = public.receipt_counters.last_no + 1,
                updated_at = now()
  RETURNING last_no INTO v_no;

  RETURN v_kind || '-' || v_year::text || '-' || lpad(v_no::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_receipt_no(TEXT) TO authenticated;
