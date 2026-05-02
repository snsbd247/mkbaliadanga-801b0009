-- Trigger / system-only functions: revoke from anon & authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_office_id_from_farmer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_office_id_from_loan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_alloc_office_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_land_relation_office() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_irrigation_arrears() FROM PUBLIC, anon, authenticated;

-- get_previous_due / compute_penalty are only used by triggers — revoke
REVOKE EXECUTE ON FUNCTION public.get_previous_due(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_penalty(numeric, integer) FROM PUBLIC, anon, authenticated;

-- _lookup_email_by_username should NOT be public — wrapper email_for_username stays public
REVOKE EXECUTE ON FUNCTION public._lookup_email_by_username(text) FROM PUBLIC, anon, authenticated;

-- Keep these callable (RLS / login):
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_office() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_committee_or_super(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;