
-- Make both wrappers SECURITY DEFINER so anon can resolve username -> email at login
CREATE OR REPLACE FUNCTION public._lookup_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select email from public.profiles where lower(username) = lower(_username) limit 1;
$$;

CREATE OR REPLACE FUNCTION public.email_for_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select email from public.profiles where lower(username) = lower(_username) limit 1;
$$;

REVOKE ALL ON FUNCTION public._lookup_email_by_username(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._lookup_email_by_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;
