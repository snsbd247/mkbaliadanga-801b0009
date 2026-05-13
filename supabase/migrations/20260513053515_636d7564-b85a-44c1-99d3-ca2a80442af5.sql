CREATE OR REPLACE FUNCTION public.exec_sql_admin(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'developer'::app_role) THEN
    RAISE EXCEPTION 'forbidden: developer role required';
  END IF;
  EXECUTE sql;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exec_sql_admin(text) TO authenticated, service_role;