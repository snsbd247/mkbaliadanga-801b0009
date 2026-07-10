CREATE OR REPLACE FUNCTION public.exec_sql_admin(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  fk RECORD;
  fkdefs text[] := '{}';
  def text;
  is_service boolean := false;
BEGIN
  -- Authorize: developer role (user JWT) OR the service role (edge function).
  BEGIN
    is_service := coalesce(
      (current_setting('request.jwt.claims', true)::json ->> 'role'),
      ''
    ) = 'service_role';
  EXCEPTION WHEN others THEN
    is_service := false;
  END;

  IF NOT (public.has_role(auth.uid(), 'developer'::app_role) OR is_service) THEN
    RAISE EXCEPTION 'forbidden: developer role required';
  END IF;

  -- Capture and drop every public foreign key so the restore payload can load
  -- data in any order (handles self-referencing and cross-table dependencies).
  FOR fk IN
    SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS cdef
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
  LOOP
    fkdefs := array_append(
      fkdefs,
      format('ALTER TABLE %s ADD CONSTRAINT %I %s', fk.tbl, fk.conname, fk.cdef)
    );
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
  END LOOP;

  -- Run the restore payload (TRUNCATE + INSERT statements).
  EXECUTE sql;

  -- Recreate the foreign keys exactly as before.
  FOREACH def IN ARRAY fkdefs LOOP
    EXECUTE def;
  END LOOP;
END;
$function$;