ALTER TABLE public.lands
  ADD COLUMN IF NOT EXISTS dag_numbers text[] NOT NULL DEFAULT '{}';

-- Backfill from existing dag_no (split on comma if multiple already present)
UPDATE public.lands
SET dag_numbers = CASE
  WHEN dag_no IS NULL OR btrim(dag_no) = '' THEN '{}'::text[]
  ELSE ARRAY(
    SELECT btrim(x)
    FROM regexp_split_to_table(dag_no, E'\\s*,\\s*') AS x
    WHERE btrim(x) <> ''
  )
END
WHERE COALESCE(array_length(dag_numbers, 1), 0) = 0;

CREATE OR REPLACE FUNCTION public.lands_sync_dag_numbers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cleaned text[];
BEGIN
  IF NEW.dag_numbers IS NOT NULL AND COALESCE(array_length(NEW.dag_numbers, 1), 0) > 0 THEN
    cleaned := ARRAY(
      SELECT btrim(x)
      FROM unnest(NEW.dag_numbers) AS x
      WHERE btrim(x) <> ''
    );
    NEW.dag_numbers := cleaned;
    NEW.dag_no := NULLIF(array_to_string(cleaned, ', '), '');
  ELSIF NEW.dag_no IS NOT NULL AND btrim(NEW.dag_no) <> '' THEN
    cleaned := ARRAY(
      SELECT btrim(x)
      FROM regexp_split_to_table(NEW.dag_no, E'\\s*,\\s*') AS x
      WHERE btrim(x) <> ''
    );
    NEW.dag_numbers := cleaned;
    NEW.dag_no := array_to_string(cleaned, ', ');
  ELSE
    NEW.dag_numbers := '{}'::text[];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lands_sync_dag_numbers_t ON public.lands;
CREATE TRIGGER lands_sync_dag_numbers_t
BEFORE INSERT OR UPDATE OF dag_no, dag_numbers ON public.lands
FOR EACH ROW EXECUTE FUNCTION public.lands_sync_dag_numbers();

CREATE INDEX IF NOT EXISTS lands_dag_numbers_gin ON public.lands USING gin (dag_numbers);