REVOKE EXECUTE ON FUNCTION public.get_land_billing_split(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_land_billing_split(uuid, date) TO authenticated, service_role;