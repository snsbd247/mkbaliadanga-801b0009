REVOKE EXECUTE ON FUNCTION public.list_collector_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_collector_users() TO authenticated;