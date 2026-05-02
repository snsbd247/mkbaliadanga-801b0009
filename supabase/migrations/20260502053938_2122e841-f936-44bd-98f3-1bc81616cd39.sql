-- Grant EXECUTE on all RLS-helper functions so policies don't fail with "permission denied"
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_office() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_committee_or_super(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_previous_due(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_penalty(numeric, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lookup_email_by_username(text) TO anon, authenticated;