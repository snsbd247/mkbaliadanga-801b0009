CREATE OR REPLACE FUNCTION public.lands_sync_dag_numbers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cleaned text[];
  v text;
  seen text[] := '{}';
  lower_v text;
BEGIN
  -- Step 1: derive cleaned array from whichever column changed.
  IF NEW.dag_numbers IS NOT NULL AND COALESCE(array_length(NEW.dag_numbers, 1), 0) > 0 THEN
    cleaned := ARRAY(
      SELECT btrim(x)
      FROM unnest(NEW.dag_numbers) AS x
      WHERE btrim(x) <> ''
    );
  ELSIF NEW.dag_no IS NOT NULL AND btrim(NEW.dag_no) <> '' THEN
    cleaned := ARRAY(
      SELECT btrim(x)
      FROM regexp_split_to_table(NEW.dag_no, E'\\s*,\\s*') AS x
      WHERE btrim(x) <> ''
    );
  ELSE
    cleaned := '{}'::text[];
  END IF;

  -- Step 2: validate each token + duplicate check.
  IF cleaned IS NOT NULL AND array_length(cleaned, 1) IS NOT NULL THEN
    FOREACH v IN ARRAY cleaned LOOP
      IF length(v) > 32 THEN
        RAISE EXCEPTION 'দাগ নাম্বার "%": ৩২ অক্ষরের বেশি হতে পারবে না', v
          USING ERRCODE = 'check_violation';
      END IF;
      IF v !~ '^[A-Za-z0-9০-৯/\-]+$' THEN
        RAISE EXCEPTION 'দাগ নাম্বার "%": শুধু সংখ্যা, অক্ষর, ''/'' এবং ''-'' ব্যবহার করা যাবে', v
          USING ERRCODE = 'check_violation';
      END IF;
      lower_v := lower(v);
      IF lower_v = ANY(SELECT lower(x) FROM unnest(seen) AS x) THEN
        RAISE EXCEPTION 'ডুপ্লিকেট দাগ নাম্বার: "%"', v
          USING ERRCODE = 'unique_violation';
      END IF;
      seen := array_append(seen, v);
    END LOOP;
  END IF;

  -- Step 3: write canonical form back into both columns.
  NEW.dag_numbers := cleaned;
  IF cleaned IS NULL OR array_length(cleaned, 1) IS NULL THEN
    NEW.dag_no := NULL;
  ELSE
    NEW.dag_no := array_to_string(cleaned, ', ');
  END IF;
  RETURN NEW;
END;
$$;