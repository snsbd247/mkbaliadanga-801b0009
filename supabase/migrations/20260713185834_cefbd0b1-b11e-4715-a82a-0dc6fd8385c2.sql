CREATE OR REPLACE FUNCTION public.merge_farmers_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  authed_can_exec boolean;
  is_admin boolean;
BEGIN
  SELECT has_function_privilege('authenticated', 'public.merge_farmers(uuid,uuid)', 'EXECUTE')
    INTO authed_can_exec;
  is_admin := public.has_role(uid, 'admin')
    OR public.has_role(uid, 'super_admin')
    OR public.has_role(uid, 'developer');
  RETURN jsonb_build_object(
    'rpc_exists', to_regprocedure('public.merge_farmers(uuid,uuid)') IS NOT NULL,
    'authenticated_can_execute', COALESCE(authed_can_exec, false),
    'caller_is_admin', COALESCE(is_admin, false),
    'caller_id', uid
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.merge_farmers_health() TO authenticated;
NOTIFY pgrst, 'reload schema';