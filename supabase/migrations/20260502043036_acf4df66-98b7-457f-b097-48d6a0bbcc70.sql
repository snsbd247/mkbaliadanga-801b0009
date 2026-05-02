-- 1. Idempotency key on payments
alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists payments_idempotency_key_uidx
  on public.payments (collected_by, idempotency_key)
  where idempotency_key is not null;

-- 2. Payment allocations: split one payment across multiple targets
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  kind text not null check (kind in ('loan','savings','irrigation')),
  reference_id uuid,
  amount numeric not null check (amount > 0),
  office_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index if not exists payment_allocations_kind_ref_idx on public.payment_allocations(kind, reference_id);

alter table public.payment_allocations enable row level security;

create policy "office read allocations" on public.payment_allocations
  for select to authenticated
  using (
    has_role(auth.uid(),'super_admin') or office_id = current_user_office()
    or exists (select 1 from public.payments p where p.id = payment_id and (has_role(auth.uid(),'super_admin') or p.office_id = current_user_office()))
  );

create policy "office insert allocations" on public.payment_allocations
  for insert to authenticated
  with check (
    has_role(auth.uid(),'super_admin') or office_id = current_user_office() or office_id is null
  );

create policy "admin update allocations" on public.payment_allocations
  for update to authenticated using (is_admin_or_super(auth.uid()));

create policy "admin delete allocations" on public.payment_allocations
  for delete to authenticated using (is_admin_or_super(auth.uid()));

-- Backfill office_id from parent payment
create or replace function public.set_alloc_office_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.office_id is null and NEW.payment_id is not null then
    select office_id into NEW.office_id from public.payments where id = NEW.payment_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_alloc_office on public.payment_allocations;
create trigger trg_alloc_office before insert on public.payment_allocations
for each row execute function public.set_alloc_office_id();

-- 3. Ensure audit triggers exist on all critical tables
do $$
declare
  tbl text;
  tables text[] := array['loans','loan_payments','irrigation_charges','savings_transactions','payments','payment_allocations','farmers','lands','shares'];
begin
  foreach tbl in array tables loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', tbl, tbl);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on public.%I
       for each row execute function public.audit_trigger()', tbl, tbl);
  end loop;
end $$;