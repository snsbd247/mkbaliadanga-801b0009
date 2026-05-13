CREATE OR REPLACE FUNCTION public.pg_tables_public_list()
RETURNS TABLE(tablename text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%'
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.pg_tables_public_list() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pg_tables_public_list() TO service_role;