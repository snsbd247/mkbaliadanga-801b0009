
ALTER VIEW public.farmer_savings_balance SET (security_invoker = on);
ALTER VIEW public.ledger_entries_view SET (security_invoker = on);
ALTER VIEW public.lands_with_location SET (security_invoker = on);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname NOT IN ('_lookup_email_by_username','email_for_username')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_committee_or_super(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_developer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_developer_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_office() TO authenticated;
