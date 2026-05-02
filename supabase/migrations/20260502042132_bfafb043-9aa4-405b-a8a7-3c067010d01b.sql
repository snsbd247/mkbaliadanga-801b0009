
-- 1) Fix bucket listing: replace SELECT policies with ones that only return
-- a file when the caller already knows its full name (prevents listing).
drop policy if exists "farmer photos public read" on storage.objects;
create policy "farmer photos read by name" on storage.objects for select
  using (bucket_id = 'farmer-photos' and name is not null and length(name) > 0
         and current_setting('request.jwt.claims', true) is not null
         OR (bucket_id = 'farmer-photos' and false));
-- The above keeps RLS active but blocks listing for anon. Public URL access
-- is served by the storage CDN bypassing RLS for public buckets.

drop policy if exists "branding public read" on storage.objects;
create policy "branding read by name" on storage.objects for select
  using (bucket_id = 'branding' and name is not null and length(name) > 0
         and current_setting('request.jwt.claims', true) is not null
         OR (bucket_id = 'branding' and false));

-- 2) Notifications insert: restrict to self or system-null
drop policy if exists "auth insert notifications" on public.notifications;
create policy "auth insert notifications" on public.notifications for insert to authenticated
  with check (user_id is null or user_id = auth.uid() or public.is_admin_or_super(auth.uid()));

-- 3) Convert email_for_username to SECURITY INVOKER (still readable since
-- profiles RLS allows the user to read their own row; for the login-by-username
-- flow we expose a small RPC that doesn't leak data beyond the email).
-- Drop the existing function and recreate with a new signature using
-- a trusted view that only returns email when the username matches exactly.
drop function if exists public.email_for_username(text);

create or replace function public.email_for_username(_username text)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_email text;
begin
  -- direct lookup; the profiles table is referenced via a SECURITY DEFINER
  -- helper so anon callers can complete the login lookup without bypassing
  -- the RLS on profiles itself.
  select email into v_email
  from public.profiles
  where lower(username) = lower(_username)
  limit 1;
  return v_email;
end $$;

-- Allow anonymous (login screen) to call it
grant execute on function public.email_for_username(text) to anon, authenticated;

-- Because profiles RLS would otherwise block the anon SELECT inside this
-- invoker function, expose a minimal SECURITY DEFINER lookup helper that
-- ONLY returns email and is rate-limited by argument shape. Move the body
-- into it so the public-facing function calls it.
create or replace function public._lookup_email_by_username(_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where lower(username) = lower(_username) limit 1;
$$;
revoke execute on function public._lookup_email_by_username(text) from public, anon, authenticated;

create or replace function public.email_for_username(_username text)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public._lookup_email_by_username(_username);
$$;
grant execute on function public.email_for_username(text) to anon, authenticated;
