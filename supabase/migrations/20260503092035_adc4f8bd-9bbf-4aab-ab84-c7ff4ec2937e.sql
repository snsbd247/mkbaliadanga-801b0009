
-- ==========================================
-- 1) user_roles RLS: allow same-office admin role mgmt
-- ==========================================
drop policy if exists "admin manage office roles" on public.user_roles;
drop policy if exists "admin update office roles" on public.user_roles;
drop policy if exists "admin insert office roles" on public.user_roles;
drop policy if exists "admin delete office roles" on public.user_roles;

create policy "admin insert office roles"
  on public.user_roles for insert to authenticated
  with check (
    public.is_admin_or_super(auth.uid())
    and role <> 'super_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = user_roles.user_id
        and (
          public.has_role(auth.uid(), 'super_admin')
          or p.office_id = public.current_user_office()
        )
    )
  );

create policy "admin update office roles"
  on public.user_roles for update to authenticated
  using (
    public.is_admin_or_super(auth.uid())
    and role <> 'super_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = user_roles.user_id
        and (
          public.has_role(auth.uid(), 'super_admin')
          or p.office_id = public.current_user_office()
        )
    )
  )
  with check (
    public.is_admin_or_super(auth.uid())
    and role <> 'super_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = user_roles.user_id
        and (
          public.has_role(auth.uid(), 'super_admin')
          or p.office_id = public.current_user_office()
        )
    )
  );

create policy "admin delete office roles"
  on public.user_roles for delete to authenticated
  using (
    public.is_admin_or_super(auth.uid())
    and role <> 'super_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = user_roles.user_id
        and (
          public.has_role(auth.uid(), 'super_admin')
          or p.office_id = public.current_user_office()
        )
    )
  );

-- Prevent super admin self-demotion
create or replace function public.prevent_super_admin_self_demotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'super_admin' and old.user_id = auth.uid()) then
    raise exception 'Super admin cannot remove their own super_admin role';
  end if;
  if (tg_op = 'UPDATE' and old.role = 'super_admin' and old.user_id = auth.uid() and new.role <> 'super_admin') then
    raise exception 'Super admin cannot demote their own super_admin role';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_prevent_super_admin_self_demotion on public.user_roles;
create trigger trg_prevent_super_admin_self_demotion
  before update or delete on public.user_roles
  for each row execute function public.prevent_super_admin_self_demotion();

-- ==========================================
-- 2) voter_audit_logs table
-- ==========================================
create table if not exists public.voter_audit_logs (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null,
  account_number text,
  voter_number_old text,
  voter_number_new text,
  is_voter_old boolean,
  is_voter_new boolean,
  changed_by uuid,
  office_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_voter_audit_farmer on public.voter_audit_logs (farmer_id, created_at desc);
create index if not exists idx_voter_audit_office on public.voter_audit_logs (office_id, created_at desc);
create index if not exists idx_voter_audit_created on public.voter_audit_logs (created_at desc);

alter table public.voter_audit_logs enable row level security;

drop policy if exists "office read voter_audit" on public.voter_audit_logs;
create policy "office read voter_audit"
  on public.voter_audit_logs for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin')
    or office_id = public.current_user_office()
  );

-- Trigger function
create or replace function public.log_voter_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.voter_number is distinct from old.voter_number)
     or (new.is_voter is distinct from old.is_voter) then
    insert into public.voter_audit_logs (
      farmer_id, account_number,
      voter_number_old, voter_number_new,
      is_voter_old, is_voter_new,
      changed_by, office_id
    ) values (
      new.id, new.account_number,
      old.voter_number, new.voter_number,
      old.is_voter, new.is_voter,
      auth.uid(), new.office_id
    );
  end if;
  return new;
end $$;

-- Replace the older audit_logs voter trigger if it exists
drop trigger if exists trg_audit_farmer_voter_number on public.farmers;
drop trigger if exists trg_log_voter_change on public.farmers;
create trigger trg_log_voter_change
  after update of voter_number, is_voter on public.farmers
  for each row execute function public.log_voter_change();
