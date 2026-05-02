-- Allow anonymous and authenticated to call the username->email lookup RPC.
-- The underlying _lookup_email_by_username is SECURITY DEFINER and only returns a single email.
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lookup_email_by_username(text) TO anon, authenticated;