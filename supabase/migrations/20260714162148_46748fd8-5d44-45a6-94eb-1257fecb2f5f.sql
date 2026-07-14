REVOKE EXECUTE ON FUNCTION public.enforce_irrigation_invoice_billed_area() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_irrigation_invoice_billed_area() TO service_role;

NOTIFY pgrst, 'reload schema';