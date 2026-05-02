
-- 1) company_settings (single row, id=1)
create table if not exists public.company_settings (
  id int primary key default 1,
  company_name text not null default 'Smart Irrigation Cooperative',
  company_name_bn text,
  logo_url text,
  email text,
  mobile text,
  address text,
  default_loan_interest numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint company_settings_singleton check (id = 1)
);
alter table public.company_settings enable row level security;

create policy "auth read company_settings"
  on public.company_settings for select to authenticated using (true);
create policy "super admin manage company_settings"
  on public.company_settings for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

insert into public.company_settings (id) values (1) on conflict (id) do nothing;

-- 2) username on profiles
alter table public.profiles add column if not exists username text unique;
create index if not exists profiles_username_idx on public.profiles (lower(username));

-- 3) granular per-user permissions
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  can_view boolean not null default true,
  can_add boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  unique (user_id, module)
);
alter table public.user_permissions enable row level security;

create policy "users read own permissions"
  on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
create policy "super admin manage permissions"
  on public.user_permissions for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- 4) notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() or user_id is null or public.has_role(auth.uid(), 'super_admin'));
create policy "users update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
create policy "auth insert notifications"
  on public.notifications for insert to authenticated with check (true);
create policy "admin delete notifications"
  on public.notifications for delete to authenticated
  using (public.is_admin_or_super(auth.uid()));

-- 5) helper: lookup email by username (security definer)
create or replace function public.email_for_username(_username text)
returns text language sql stable security definer set search_path = public as $$
  select email from public.profiles where lower(username) = lower(_username) limit 1;
$$;

-- 6) branding storage bucket (public)
insert into storage.buckets (id, name, public)
  values ('branding', 'branding', true)
  on conflict (id) do nothing;

create policy "branding public read"
  on storage.objects for select using (bucket_id = 'branding');
create policy "admin upload branding"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin_or_super(auth.uid()));
create policy "admin update branding"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin_or_super(auth.uid()));
create policy "admin delete branding"
  on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin_or_super(auth.uid()));
