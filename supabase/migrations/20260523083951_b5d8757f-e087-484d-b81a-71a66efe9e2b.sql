
REVOKE ALL ON FUNCTION public.next_monthly_receipt_no(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_monthly_receipt_no(uuid, text) TO authenticated;
