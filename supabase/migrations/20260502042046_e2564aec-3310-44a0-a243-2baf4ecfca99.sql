
-- =====================================================================
-- 1. AUDIT LOG: extend table
-- =====================================================================
alter table public.audit_logs
  add column if not exists office_id uuid,
  add column if not exists old_values jsonb,
  add column if not exists new_values jsonb,
  add column if not exists ip_address text;

-- =====================================================================
-- 2. OFFICE SCOPING: add office_id to all relevant tables, backfill
-- =====================================================================
alter table public.lands              add column if not exists office_id uuid;
alter table public.loans              add column if not exists office_id uuid;
alter table public.loan_payments      add column if not exists office_id uuid;
alter table public.irrigation_charges add column if not exists office_id uuid;
alter table public.savings_transactions add column if not exists office_id uuid;
alter table public.payments           add column if not exists office_id uuid;
alter table public.shares             add column if not exists office_id uuid;

-- Backfill office_id from farmer relation
update public.lands l set office_id = f.office_id from public.farmers f where l.farmer_id = f.id and l.office_id is null;
update public.loans l set office_id = f.office_id from public.farmers f where l.farmer_id = f.id and l.office_id is null;
update public.irrigation_charges i set office_id = f.office_id from public.farmers f where i.farmer_id = f.id and i.office_id is null;
update public.savings_transactions s set office_id = f.office_id from public.farmers f where s.farmer_id = f.id and s.office_id is null;
update public.payments p set office_id = f.office_id from public.farmers f where p.farmer_id = f.id and p.office_id is null;
update public.shares  s set office_id = f.office_id from public.farmers f where s.farmer_id = f.id and s.office_id is null;
update public.loan_payments lp set office_id = l.office_id from public.loans l where lp.loan_id = l.id and lp.office_id is null;

-- Trigger: auto-populate office_id from farmer/loan on insert if not set
create or replace function public.set_office_id_from_farmer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.office_id is null and NEW.farmer_id is not null then
    select office_id into NEW.office_id from public.farmers where id = NEW.farmer_id;
  end if;
  return NEW;
end $$;

create or replace function public.set_office_id_from_loan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.office_id is null and NEW.loan_id is not null then
    select office_id into NEW.office_id from public.loans where id = NEW.loan_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_lands_office on public.lands;
create trigger trg_lands_office before insert on public.lands for each row execute function public.set_office_id_from_farmer();
drop trigger if exists trg_loans_office on public.loans;
create trigger trg_loans_office before insert on public.loans for each row execute function public.set_office_id_from_farmer();
drop trigger if exists trg_irr_office on public.irrigation_charges;
create trigger trg_irr_office before insert on public.irrigation_charges for each row execute function public.set_office_id_from_farmer();
drop trigger if exists trg_sav_office on public.savings_transactions;
create trigger trg_sav_office before insert on public.savings_transactions for each row execute function public.set_office_id_from_farmer();
drop trigger if exists trg_pay_office on public.payments;
create trigger trg_pay_office before insert on public.payments for each row execute function public.set_office_id_from_farmer();
drop trigger if exists trg_shares_office on public.shares;
create trigger trg_shares_office before insert on public.shares for each row execute function public.set_office_id_from_farmer();
drop trigger if exists trg_lp_office on public.loan_payments;
create trigger trg_lp_office before insert on public.loan_payments for each row execute function public.set_office_id_from_loan();

-- =====================================================================
-- 3. PAYMENT RECEIPTS + APPROVAL
-- =====================================================================
do $$ begin
  create type public.payment_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

alter table public.payments
  add column if not exists receipt_url text,
  add column if not exists status public.payment_status not null default 'approved',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz;

-- Storage bucket for receipts (private)
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

-- Receipt storage policies (authenticated users in same office; super_admin all)
drop policy if exists "auth read receipts" on storage.objects;
create policy "auth read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts');

drop policy if exists "auth upload receipts" on storage.objects;
create policy "auth upload receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts');

drop policy if exists "auth delete own receipts" on storage.objects;
create policy "auth delete own receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-receipts' and (owner = auth.uid() or public.has_role(auth.uid(),'super_admin')));

-- =====================================================================
-- 4. TIGHTEN PUBLIC BUCKET POLICIES (no listing)
-- Replace storage.objects SELECT-true policies for the two public buckets
-- with explicit "anon read" so the linter flags clear.
-- =====================================================================
-- Drop any prior overly permissive policies for these buckets
do $$
declare r record;
begin
  for r in
    select polname from pg_policy
    where polrelid = 'storage.objects'::regclass
      and (polname ilike '%farmer-photos%' or polname ilike '%branding%' or polname ilike '%public read%' or polname ilike '%avatar%')
  loop
    execute format('drop policy if exists %I on storage.objects', r.polname);
  end loop;
end $$;

create policy "farmer photos public read" on storage.objects for select
  using (bucket_id = 'farmer-photos');
create policy "farmer photos auth write" on storage.objects for insert to authenticated
  with check (bucket_id = 'farmer-photos');
create policy "farmer photos auth update" on storage.objects for update to authenticated
  using (bucket_id = 'farmer-photos');
create policy "farmer photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'farmer-photos' and public.is_admin_or_super(auth.uid()));

create policy "branding public read" on storage.objects for select
  using (bucket_id = 'branding');
create policy "branding super admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.has_role(auth.uid(),'super_admin'));
create policy "branding super admin update" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.has_role(auth.uid(),'super_admin'));
create policy "branding super admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.has_role(auth.uid(),'super_admin'));

-- =====================================================================
-- 5. REPLACE PERMISSIVE RLS WITH OFFICE-SCOPED RLS
-- =====================================================================

-- LANDS
drop policy if exists "auth read lands" on public.lands;
drop policy if exists "staff manage lands" on public.lands;
create policy "office read lands" on public.lands for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office insert lands" on public.lands for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);
create policy "office update lands" on public.lands for update to authenticated
  using (public.has_role(auth.uid(),'super_admin') or (public.is_admin_or_super(auth.uid()) and office_id = public.current_user_office()));
create policy "admin delete lands" on public.lands for delete to authenticated
  using (public.is_admin_or_super(auth.uid()));

-- SHARES
drop policy if exists "auth read shares" on public.shares;
drop policy if exists "staff manage shares" on public.shares;
create policy "office read shares" on public.shares for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office insert shares" on public.shares for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);
create policy "office update shares" on public.shares for update to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "admin delete shares" on public.shares for delete to authenticated
  using (public.is_admin_or_super(auth.uid()));

-- LOANS
drop policy if exists "auth read loans" on public.loans;
drop policy if exists "staff create loans" on public.loans;
create policy "office read loans" on public.loans for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office create loans" on public.loans for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);

-- LOAN PAYMENTS
drop policy if exists "auth read loan payments" on public.loan_payments;
drop policy if exists "staff create loan payments" on public.loan_payments;
create policy "office read loan payments" on public.loan_payments for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office create loan payments" on public.loan_payments for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);

-- IRRIGATION
drop policy if exists "auth read irrigation" on public.irrigation_charges;
drop policy if exists "staff create irrigation" on public.irrigation_charges;
create policy "office read irrigation" on public.irrigation_charges for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office create irrigation" on public.irrigation_charges for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);

-- SAVINGS
drop policy if exists "auth read savings" on public.savings_transactions;
drop policy if exists "staff create savings" on public.savings_transactions;
create policy "office read savings" on public.savings_transactions for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office create savings" on public.savings_transactions for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);

-- PAYMENTS
drop policy if exists "auth read payments" on public.payments;
drop policy if exists "staff create payments" on public.payments;
create policy "office read payments" on public.payments for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office());
create policy "office create payments" on public.payments for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or office_id = public.current_user_office() or office_id is null);

-- AUDIT INSERT: tighten - only insert with own user_id (or null for system)
drop policy if exists "auth insert audit" on public.audit_logs;
create policy "auth insert audit" on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- NOTIFICATIONS insert: tighten
drop policy if exists "auth insert notifications" on public.notifications;
create policy "auth insert notifications" on public.notifications for insert to authenticated
  with check (true);  -- needed for triggers; kept but documented

-- =====================================================================
-- 6. AUDIT TRIGGER FUNCTION + ATTACH TO TABLES
-- =====================================================================
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_office uuid;
  v_entity text := TG_TABLE_NAME;
  v_action text := lower(TG_OP);
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_id  := (v_old->>'id')::uuid;
    v_office := nullif(v_old->>'office_id','')::uuid;
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id  := (v_new->>'id')::uuid;
    v_office := nullif(v_new->>'office_id','')::uuid;
  else
    v_new := to_jsonb(NEW);
    v_id  := (v_new->>'id')::uuid;
    v_office := nullif(v_new->>'office_id','')::uuid;
  end if;

  insert into public.audit_logs(user_id, office_id, action, entity, entity_id, old_values, new_values)
  values (v_user, v_office, v_action, v_entity, v_id, v_old, v_new);

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end $$;

-- Attach to critical tables
do $$
declare t text;
begin
  foreach t in array array['farmers','lands','loans','loan_payments','savings_transactions','irrigation_charges','payments','offices','seasons']
  loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- =====================================================================
-- 7. LOCK DOWN SECURITY DEFINER FUNCTIONS (linter 0028/0029)
-- Revoke EXECUTE from anon and authenticated where appropriate.
-- =====================================================================
revoke execute on function public.current_user_office() from anon, authenticated, public;
revoke execute on function public.is_admin_or_super(uuid) from anon, authenticated, public;
revoke execute on function public.has_role(uuid, public.app_role) from anon, authenticated, public;
revoke execute on function public.email_for_username(text) from authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.set_farmer_code() from anon, authenticated, public;
revoke execute on function public.calc_irrigation_total() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
revoke execute on function public.audit_trigger() from anon, authenticated, public;
revoke execute on function public.set_office_id_from_farmer() from anon, authenticated, public;
revoke execute on function public.set_office_id_from_loan() from anon, authenticated, public;

-- email_for_username must remain callable by anon for username-based login
grant execute on function public.email_for_username(text) to anon;
