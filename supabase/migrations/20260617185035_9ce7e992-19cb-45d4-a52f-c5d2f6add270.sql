REVOKE EXECUTE ON FUNCTION public.exec_sql_admin(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql_admin(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql_admin(text) TO service_role;