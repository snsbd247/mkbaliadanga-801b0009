-- Bulk revoke EXECUTE from PUBLIC/anon for all SECURITY DEFINER functions in public schema.
-- Authenticated role retains access where it was previously granted.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', r.schema_name, r.func_name, r.args);
    EXCEPTION WHEN OTHERS THEN
      -- ignore functions we cannot modify (owned elsewhere)
      NULL;
    END;
  END LOOP;
END $$;