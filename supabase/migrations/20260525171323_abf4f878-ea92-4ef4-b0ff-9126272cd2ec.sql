
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_office() TO anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.is_developer(uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.is_developer_user(uuid) TO anon, public;
