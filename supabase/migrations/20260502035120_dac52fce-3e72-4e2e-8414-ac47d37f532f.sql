
-- ============ ENUMS ============
create type public.app_role as enum ('super_admin', 'admin', 'staff');
create type public.season_type as enum ('aman', 'boro', 'iri', 'other');
create type public.owner_type as enum ('owner', 'borgadar');
create type public.field_type as enum ('high_land', 'medium_land', 'low_land', 'other');
create type public.savings_txn_type as enum ('deposit', 'withdraw');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.loan_status as enum ('pending', 'approved', 'paid', 'rejected');
create type public.irrigation_basis as enum ('per_size', 'per_day', 'per_hour');
create type public.payment_kind as enum ('loan', 'savings', 'irrigation');

-- ============ OFFICES ============
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_no text,
  established_on date,
  contact text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  office_id uuid references public.offices(id) on delete set null,
  language_pref text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);

-- security definer role check
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin_or_super(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin','super_admin')
  );
$$;

create or replace function public.current_user_office()
returns uuid
language sql stable security definer set search_path = public
as $$
  select office_id from public.profiles where id = auth.uid();
$$;

-- ============ SEASONS ============
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  type public.season_type not null,
  name text,
  created_at timestamptz not null default now(),
  unique(year, type)
);

-- ============ FARMERS ============
create sequence public.farmer_code_seq;

create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  farmer_code text unique not null,
  name_en text not null,
  name_bn text,
  father_name text,
  mother_name text,
  nid text,
  mobile text,
  village text,
  post_office text,
  upazila text,
  district text,
  division text,
  address text,
  photo_url text,
  office_id uuid references public.offices(id) on delete set null,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_farmer_code()
returns trigger language plpgsql as $$
declare
  next_num int;
begin
  if new.farmer_code is null or new.farmer_code = '' then
    next_num := nextval('public.farmer_code_seq');
    new.farmer_code := to_char(now(), 'YYYY') || '-' || lpad(next_num::text, 8, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_farmer_code
before insert on public.farmers
for each row execute function public.set_farmer_code();

-- ============ LANDS ============
create table public.lands (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  mouza text,
  dag_no text,
  land_size numeric(12,3) not null default 0,
  owner_type public.owner_type not null default 'owner',
  field_type public.field_type not null default 'medium_land',
  created_at timestamptz not null default now()
);

-- ============ SAVINGS ============
create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  type public.savings_txn_type not null,
  amount numeric(14,2) not null check (amount > 0),
  status public.approval_status not null default 'approved',
  txn_date date not null default current_date,
  note text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null unique references public.farmers(id) on delete cascade,
  balance numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ============ LOANS ============
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  principal numeric(14,2) not null check (principal > 0),
  interest_enabled boolean not null default true,
  interest_rate numeric(6,3) not null default 0,
  total_payable numeric(14,2) not null default 0,
  issued_on date not null default current_date,
  next_due_on date,
  status public.loan_status not null default 'pending',
  approved_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default current_date,
  collected_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============ IRRIGATION ============
create table public.irrigation_charges (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  land_id uuid not null references public.lands(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  basis public.irrigation_basis not null default 'per_size',
  quantity numeric(12,3) not null default 0,
  base_charge numeric(14,2) not null default 0,
  canal_charge numeric(14,2) not null default 0,
  maintenance_charge numeric(14,2) not null default 0,
  other_charge numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  due_amount numeric(14,2) not null default 0,
  entry_date date not null default current_date,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.calc_irrigation_total()
returns trigger language plpgsql as $$
begin
  new.total := coalesce(new.base_charge,0)+coalesce(new.canal_charge,0)+coalesce(new.maintenance_charge,0)+coalesce(new.other_charge,0);
  new.due_amount := new.total - coalesce(new.paid_amount,0);
  return new;
end;
$$;

create trigger trg_calc_irrigation_total
before insert or update on public.irrigation_charges
for each row execute function public.calc_irrigation_total();

-- ============ PAYMENTS (unified) ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  kind public.payment_kind not null,
  reference_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  method text default 'cash',
  note text,
  collected_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============ AUDIT LOGS ============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  entity text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index idx_farmers_office on public.farmers(office_id);
create index idx_lands_farmer on public.lands(farmer_id);
create index idx_savings_farmer on public.savings_transactions(farmer_id);
create index idx_loans_farmer on public.loans(farmer_id);
create index idx_irrigation_farmer on public.irrigation_charges(farmer_id);
create index idx_irrigation_season on public.irrigation_charges(season_id);
create index idx_payments_farmer on public.payments(farmer_id);

-- ============ AUTO PROFILE ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  -- Default new users to staff role
  insert into public.user_roles (user_id, role) values (new.id, 'staff')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ UPDATED_AT TRIGGERS ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger t_offices before update on public.offices for each row execute function public.touch_updated_at();
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_farmers before update on public.farmers for each row execute function public.touch_updated_at();
create trigger t_loans before update on public.loans for each row execute function public.touch_updated_at();

-- ============ RLS ============
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.seasons enable row level security;
alter table public.farmers enable row level security;
alter table public.lands enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.shares enable row level security;
alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.irrigation_charges enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "super admin manage profiles" on public.profiles for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- User roles - only super admin manages, users can read their own roles
create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "super admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- Offices
create policy "auth read offices" on public.offices for select to authenticated using (true);
create policy "super admin manage offices" on public.offices for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- Seasons - everyone reads, admin/super manages
create policy "auth read seasons" on public.seasons for select to authenticated using (true);
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_admin_or_super(auth.uid())) with check (public.is_admin_or_super(auth.uid()));

-- Farmers - office-scoped
create policy "auth read farmers" on public.farmers for select to authenticated using (
  public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office()
);
create policy "staff create farmers" on public.farmers for insert to authenticated with check (
  public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office()
);
create policy "admin update farmers" on public.farmers for update to authenticated using (
  public.has_role(auth.uid(),'super_admin') or (public.is_admin_or_super(auth.uid()) and office_id = public.current_user_office())
);
create policy "admin delete farmers" on public.farmers for delete to authenticated using (public.is_admin_or_super(auth.uid()));

-- Lands - inherit from farmer
create policy "auth read lands" on public.lands for select to authenticated using (true);
create policy "staff manage lands" on public.lands for all to authenticated using (true) with check (true);

-- Savings
create policy "auth read savings" on public.savings_transactions for select to authenticated using (true);
create policy "staff create savings" on public.savings_transactions for insert to authenticated with check (true);
create policy "admin update savings" on public.savings_transactions for update to authenticated using (public.is_admin_or_super(auth.uid()));
create policy "admin delete savings" on public.savings_transactions for delete to authenticated using (public.is_admin_or_super(auth.uid()));

-- Shares
create policy "auth read shares" on public.shares for select to authenticated using (true);
create policy "staff manage shares" on public.shares for all to authenticated using (true) with check (true);

-- Loans
create policy "auth read loans" on public.loans for select to authenticated using (true);
create policy "staff create loans" on public.loans for insert to authenticated with check (true);
create policy "admin update loans" on public.loans for update to authenticated using (public.is_admin_or_super(auth.uid()));
create policy "admin delete loans" on public.loans for delete to authenticated using (public.is_admin_or_super(auth.uid()));

-- Loan payments
create policy "auth read loan payments" on public.loan_payments for select to authenticated using (true);
create policy "staff create loan payments" on public.loan_payments for insert to authenticated with check (true);
create policy "admin manage loan payments" on public.loan_payments for update to authenticated using (public.is_admin_or_super(auth.uid()));
create policy "admin delete loan payments" on public.loan_payments for delete to authenticated using (public.is_admin_or_super(auth.uid()));

-- Irrigation
create policy "auth read irrigation" on public.irrigation_charges for select to authenticated using (true);
create policy "staff create irrigation" on public.irrigation_charges for insert to authenticated with check (true);
create policy "admin update irrigation" on public.irrigation_charges for update to authenticated using (public.is_admin_or_super(auth.uid()));
create policy "admin delete irrigation" on public.irrigation_charges for delete to authenticated using (public.is_admin_or_super(auth.uid()));

-- Payments
create policy "auth read payments" on public.payments for select to authenticated using (true);
create policy "staff create payments" on public.payments for insert to authenticated with check (true);
create policy "admin update payments" on public.payments for update to authenticated using (public.is_admin_or_super(auth.uid()));
create policy "admin delete payments" on public.payments for delete to authenticated using (public.is_admin_or_super(auth.uid()));

-- Audit logs
create policy "super admin read audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "auth insert audit" on public.audit_logs for insert to authenticated with check (true);

-- ============ STORAGE ============
insert into storage.buckets (id, name, public) values ('farmer-photos','farmer-photos', true)
on conflict (id) do nothing;

create policy "public read farmer photos" on storage.objects for select using (bucket_id='farmer-photos');
create policy "auth upload farmer photos" on storage.objects for insert to authenticated with check (bucket_id='farmer-photos');
create policy "auth update farmer photos" on storage.objects for update to authenticated using (bucket_id='farmer-photos');
create policy "auth delete farmer photos" on storage.objects for delete to authenticated using (bucket_id='farmer-photos');
