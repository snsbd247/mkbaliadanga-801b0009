-- ============================================================
-- 1. Farmers: Member No (auto-generated, unique)
-- ============================================================
create sequence if not exists public.member_no_seq start 1;

alter table public.farmers
  add column if not exists member_no text;

create unique index if not exists farmers_member_no_uidx
  on public.farmers(member_no) where member_no is not null;

create or replace function public.set_member_no()
returns trigger
language plpgsql
set search_path = public
as $$
declare n int;
begin
  if new.member_no is null or new.member_no = '' then
    n := nextval('public.member_no_seq');
    new.member_no := 'M-' || lpad(n::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_set_member_no on public.farmers;
create trigger trg_set_member_no before insert on public.farmers
for each row execute function public.set_member_no();

-- Backfill member_no for existing farmers
update public.farmers
   set member_no = 'M-' || lpad(nextval('public.member_no_seq')::text, 6, '0')
 where member_no is null;

-- ============================================================
-- 2. Land relationships (Owner ↔ Sharecropper, history)
-- ============================================================
create table if not exists public.land_relations (
  id uuid primary key default gen_random_uuid(),
  land_id uuid not null references public.lands(id) on delete cascade,
  owner_farmer_id uuid not null references public.farmers(id) on delete cascade,
  sharecropper_farmer_id uuid references public.farmers(id) on delete set null,
  share_percentage numeric not null default 50 check (share_percentage >= 0 and share_percentage <= 100),
  valid_from date not null default current_date,
  valid_to date,
  note text,
  office_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists land_relations_land_idx on public.land_relations(land_id);
create index if not exists land_relations_owner_idx on public.land_relations(owner_farmer_id);
create index if not exists land_relations_sc_idx on public.land_relations(sharecropper_farmer_id);
create index if not exists land_relations_active_idx on public.land_relations(land_id) where valid_to is null;

alter table public.land_relations enable row level security;

create policy "office read land_relations" on public.land_relations
  for select to authenticated
  using (has_role(auth.uid(),'super_admin') or office_id = current_user_office());

create policy "office insert land_relations" on public.land_relations
  for insert to authenticated
  with check (has_role(auth.uid(),'super_admin') or office_id = current_user_office() or office_id is null);

create policy "admin update land_relations" on public.land_relations
  for update to authenticated using (is_admin_or_super(auth.uid()));

create policy "admin delete land_relations" on public.land_relations
  for delete to authenticated using (is_admin_or_super(auth.uid()));

-- Backfill office_id from land
create or replace function public.set_land_relation_office()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.office_id is null and NEW.land_id is not null then
    select office_id into NEW.office_id from public.lands where id = NEW.land_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_land_rel_office on public.land_relations;
create trigger trg_land_rel_office before insert on public.land_relations
for each row execute function public.set_land_relation_office();

revoke execute on function public.set_land_relation_office() from public, anon, authenticated;

-- Audit trigger
drop trigger if exists trg_audit_land_relations on public.land_relations;
create trigger trg_audit_land_relations after insert or update or delete on public.land_relations
for each row execute function public.audit_trigger();

-- ============================================================
-- 3. Receipts (numbered) and Expenses
-- ============================================================
create sequence if not exists public.receipt_no_seq start 1;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'receipt_kind') then
    create type public.receipt_kind as enum (
      'irrigation','bigha_rent','pond','crop_sale','scrap',
      'loan_taken','donation','savings_deposit','share','other'
    );
  end if;
end $$;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text unique,
  kind public.receipt_kind not null,
  farmer_id uuid references public.farmers(id) on delete set null,
  reference_id uuid,
  amount numeric not null check (amount > 0),
  method text default 'cash',
  note text,
  receipt_date date not null default current_date,
  office_id uuid,
  collected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipts_date_idx on public.receipts(receipt_date desc);
create index if not exists receipts_kind_idx on public.receipts(kind);
create index if not exists receipts_farmer_idx on public.receipts(farmer_id);
create index if not exists receipts_office_idx on public.receipts(office_id);

create or replace function public.set_receipt_no()
returns trigger language plpgsql set search_path = public as $$
declare n int;
begin
  if new.receipt_no is null or new.receipt_no = '' then
    n := nextval('public.receipt_no_seq');
    new.receipt_no := 'R-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_set_receipt_no on public.receipts;
create trigger trg_set_receipt_no before insert on public.receipts
for each row execute function public.set_receipt_no();

drop trigger if exists trg_touch_receipts on public.receipts;
create trigger trg_touch_receipts before update on public.receipts
for each row execute function public.touch_updated_at();

alter table public.receipts enable row level security;

create policy "office read receipts" on public.receipts
  for select to authenticated
  using (has_role(auth.uid(),'super_admin') or office_id = current_user_office());

create policy "office insert receipts" on public.receipts
  for insert to authenticated
  with check (has_role(auth.uid(),'super_admin') or office_id = current_user_office() or office_id is null);

create policy "admin update receipts" on public.receipts
  for update to authenticated using (is_admin_or_super(auth.uid()));

create policy "admin delete receipts" on public.receipts
  for delete to authenticated using (is_admin_or_super(auth.uid()));

drop trigger if exists trg_audit_receipts on public.receipts;
create trigger trg_audit_receipts after insert or update or delete on public.receipts
for each row execute function public.audit_trigger();

-- Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  head text not null,
  payee text,
  amount numeric not null check (amount > 0),
  method text default 'cash',
  note text,
  office_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_head_idx on public.expenses(head);
create index if not exists expenses_office_idx on public.expenses(office_id);

drop trigger if exists trg_touch_expenses on public.expenses;
create trigger trg_touch_expenses before update on public.expenses
for each row execute function public.touch_updated_at();

alter table public.expenses enable row level security;

create policy "office read expenses" on public.expenses
  for select to authenticated
  using (has_role(auth.uid(),'super_admin') or office_id = current_user_office());

create policy "office insert expenses" on public.expenses
  for insert to authenticated
  with check (has_role(auth.uid(),'super_admin') or office_id = current_user_office() or office_id is null);

create policy "admin update expenses" on public.expenses
  for update to authenticated using (is_admin_or_super(auth.uid()));

create policy "admin delete expenses" on public.expenses
  for delete to authenticated using (is_admin_or_super(auth.uid()));

drop trigger if exists trg_audit_expenses on public.expenses;
create trigger trg_audit_expenses after insert or update or delete on public.expenses
for each row execute function public.audit_trigger();

-- ============================================================
-- 4. Penalty settings on company_settings
-- ============================================================
alter table public.company_settings
  add column if not exists penalty_type text not null default 'flat' check (penalty_type in ('flat','percent','none')),
  add column if not exists penalty_value numeric not null default 0,
  add column if not exists penalty_grace_days integer not null default 30;

-- ============================================================
-- 5. Irrigation: arrears + penalty fields
-- ============================================================
alter table public.irrigation_charges
  add column if not exists previous_due_brought numeric not null default 0,
  add column if not exists penalty_amount numeric not null default 0;

-- Update calc trigger to include penalty + arrears in total
create or replace function public.calc_irrigation_total()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(new.base_charge,0) < 0 or coalesce(new.canal_charge,0) < 0
     or coalesce(new.maintenance_charge,0) < 0 or coalesce(new.other_charge,0) < 0
     or coalesce(new.previous_due_brought,0) < 0 or coalesce(new.penalty_amount,0) < 0 then
    raise exception 'Charges cannot be negative';
  end if;
  if coalesce(new.paid_amount,0) < 0 then
    raise exception 'Paid amount cannot be negative';
  end if;
  new.total := coalesce(new.base_charge,0)
             + coalesce(new.canal_charge,0)
             + coalesce(new.maintenance_charge,0)
             + coalesce(new.other_charge,0)
             + coalesce(new.previous_due_brought,0)
             + coalesce(new.penalty_amount,0);
  if coalesce(new.paid_amount,0) > new.total then
    raise exception 'Paid amount (%) cannot exceed total (%)', new.paid_amount, new.total;
  end if;
  new.due_amount := new.total - coalesce(new.paid_amount,0);
  return new;
end $$;

-- ============================================================
-- 6. Savings yearly opening balance
-- ============================================================
create table if not exists public.savings_yearly_opening (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  year integer not null,
  opening_balance numeric not null default 0,
  office_id uuid,
  created_at timestamptz not null default now(),
  unique (farmer_id, year)
);

create index if not exists svo_farmer_year_idx on public.savings_yearly_opening(farmer_id, year desc);

alter table public.savings_yearly_opening enable row level security;

create policy "office read svo" on public.savings_yearly_opening
  for select to authenticated
  using (has_role(auth.uid(),'super_admin') or office_id = current_user_office());

create policy "admin manage svo" on public.savings_yearly_opening
  for all to authenticated
  using (is_admin_or_super(auth.uid()))
  with check (is_admin_or_super(auth.uid()));

drop trigger if exists trg_audit_svo on public.savings_yearly_opening;
create trigger trg_audit_svo after insert or update or delete on public.savings_yearly_opening
for each row execute function public.audit_trigger();