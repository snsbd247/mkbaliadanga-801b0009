
-- =====================================================================
-- 1. LOAN: auto-recompute total_payable, validation
-- =====================================================================
create or replace function public.calc_loan_total()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.principal is null or new.principal <= 0 then
    raise exception 'Loan principal must be > 0';
  end if;
  if new.interest_rate is null or new.interest_rate < 0 then
    raise exception 'Interest rate must be >= 0';
  end if;
  if new.interest_enabled then
    new.total_payable := round((new.principal * (1 + new.interest_rate / 100.0))::numeric, 2);
  else
    new.total_payable := new.principal;
    new.interest_rate := 0;
  end if;
  return new;
end $$;

drop trigger if exists trg_loan_total on public.loans;
create trigger trg_loan_total before insert or update of principal, interest_rate, interest_enabled
  on public.loans for each row execute function public.calc_loan_total();

-- =====================================================================
-- 2. IRRIGATION: tighten existing total trigger
-- =====================================================================
create or replace function public.calc_irrigation_total()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(new.base_charge,0) < 0 or coalesce(new.canal_charge,0) < 0
     or coalesce(new.maintenance_charge,0) < 0 or coalesce(new.other_charge,0) < 0 then
    raise exception 'Charges cannot be negative';
  end if;
  if coalesce(new.paid_amount,0) < 0 then
    raise exception 'Paid amount cannot be negative';
  end if;
  new.total := coalesce(new.base_charge,0)+coalesce(new.canal_charge,0)+coalesce(new.maintenance_charge,0)+coalesce(new.other_charge,0);
  if coalesce(new.paid_amount,0) > new.total then
    raise exception 'Paid amount (%) cannot exceed total (%)', new.paid_amount, new.total;
  end if;
  new.due_amount := new.total - coalesce(new.paid_amount,0);
  return new;
end $$;

revoke execute on function public.calc_irrigation_total() from anon, authenticated, public;
revoke execute on function public.calc_loan_total() from anon, authenticated, public;

drop trigger if exists trg_irr_calc on public.irrigation_charges;
create trigger trg_irr_calc before insert or update on public.irrigation_charges
  for each row execute function public.calc_irrigation_total();

-- =====================================================================
-- 3. SAVINGS: balance view + overdraw protection
-- =====================================================================
create or replace view public.farmer_savings_balance
with (security_invoker = on) as
select
  f.id as farmer_id,
  coalesce(sum(case when s.type='deposit'  and s.status='approved' then s.amount end), 0) as total_deposit,
  coalesce(sum(case when s.type='withdraw' and s.status='approved' then s.amount end), 0) as total_withdraw,
  coalesce(sum(case when s.type='deposit'  and s.status='approved' then s.amount end), 0)
    - coalesce(sum(case when s.type='withdraw' and s.status='approved' then s.amount end), 0) as balance
from public.farmers f
left join public.savings_transactions s on s.farmer_id = f.id
group by f.id;

create or replace function public.check_savings_balance()
returns trigger language plpgsql set search_path = public as $$
declare
  v_balance numeric;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Savings amount must be > 0';
  end if;
  if new.type = 'withdraw' and new.status = 'approved' then
    select coalesce(sum(case when type='deposit'  and status='approved' then amount end),0)
         - coalesce(sum(case when type='withdraw' and status='approved' then amount end),0)
      into v_balance
    from public.savings_transactions
    where farmer_id = new.farmer_id
      and (TG_OP <> 'UPDATE' or id <> new.id);
    if v_balance < new.amount then
      raise exception 'Insufficient savings balance: available %, requested %', v_balance, new.amount;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.check_savings_balance() from anon, authenticated, public;

drop trigger if exists trg_savings_balance on public.savings_transactions;
create trigger trg_savings_balance before insert or update on public.savings_transactions
  for each row execute function public.check_savings_balance();

-- =====================================================================
-- 4. LOAN PAYMENTS: no overpayment
-- =====================================================================
create or replace function public.check_loan_payment()
returns trigger language plpgsql set search_path = public as $$
declare
  v_payable numeric;
  v_paid numeric;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Payment amount must be > 0';
  end if;
  select total_payable into v_payable from public.loans where id = new.loan_id;
  select coalesce(sum(amount),0) into v_paid from public.loan_payments
    where loan_id = new.loan_id and (TG_OP <> 'UPDATE' or id <> new.id);
  if (v_paid + new.amount) > v_payable then
    raise exception 'Payment exceeds remaining due (% remaining)', (v_payable - v_paid);
  end if;
  return new;
end $$;
revoke execute on function public.check_loan_payment() from anon, authenticated, public;

drop trigger if exists trg_loan_payment_check on public.loan_payments;
create trigger trg_loan_payment_check before insert or update on public.loan_payments
  for each row execute function public.check_loan_payment();

-- Mark loan as paid when fully paid
create or replace function public.mark_loan_paid()
returns trigger language plpgsql set search_path = public as $$
declare
  v_payable numeric;
  v_paid numeric;
begin
  select total_payable into v_payable from public.loans where id = new.loan_id;
  select coalesce(sum(amount),0) into v_paid from public.loan_payments where loan_id = new.loan_id;
  if v_paid >= v_payable then
    update public.loans set status = 'paid' where id = new.loan_id and status = 'approved';
  end if;
  return new;
end $$;
revoke execute on function public.mark_loan_paid() from anon, authenticated, public;

drop trigger if exists trg_loan_paid on public.loan_payments;
create trigger trg_loan_paid after insert or update on public.loan_payments
  for each row execute function public.mark_loan_paid();

-- =====================================================================
-- 5. CONSTRAINTS: non-negative, uniques, foreign-key style
-- =====================================================================
do $$ begin
  alter table public.loans add constraint loans_principal_positive check (principal > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.loans add constraint loans_rate_nonneg check (interest_rate >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.payments add constraint payments_amount_positive check (amount > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.savings_transactions add constraint sav_amount_positive check (amount > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.loan_payments add constraint lp_amount_positive check (amount > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.lands add constraint lands_size_positive check (land_size > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.shares add constraint shares_balance_nonneg check (balance >= 0);
exception when duplicate_object then null; end $$;

-- Unique: farmer NID (when present)
create unique index if not exists uq_farmers_nid on public.farmers(nid) where nid is not null and nid <> '';
-- Unique: farmer mobile per office (when present)
create unique index if not exists uq_farmers_office_mobile on public.farmers(office_id, mobile) where mobile is not null and mobile <> '';
-- Unique: one (farmer, dag_no)
create unique index if not exists uq_lands_farmer_dag on public.lands(farmer_id, dag_no) where dag_no is not null and dag_no <> '';
-- Unique: profile username
create unique index if not exists uq_profiles_username on public.profiles(lower(username)) where username is not null;

-- =====================================================================
-- 6. INDEXES for performance
-- =====================================================================
create index if not exists idx_farmers_office on public.farmers(office_id);
create index if not exists idx_farmers_status on public.farmers(status);
create index if not exists idx_farmers_name on public.farmers(name_en);

create index if not exists idx_lands_farmer on public.lands(farmer_id);
create index if not exists idx_lands_office on public.lands(office_id);

create index if not exists idx_loans_farmer on public.loans(farmer_id);
create index if not exists idx_loans_office on public.loans(office_id);
create index if not exists idx_loans_status on public.loans(status);
create index if not exists idx_loans_issued on public.loans(issued_on);

create index if not exists idx_lp_loan on public.loan_payments(loan_id);
create index if not exists idx_lp_office on public.loan_payments(office_id);

create index if not exists idx_irr_farmer on public.irrigation_charges(farmer_id);
create index if not exists idx_irr_land on public.irrigation_charges(land_id);
create index if not exists idx_irr_season on public.irrigation_charges(season_id);
create index if not exists idx_irr_office on public.irrigation_charges(office_id);
create index if not exists idx_irr_date on public.irrigation_charges(entry_date);

create index if not exists idx_sav_farmer on public.savings_transactions(farmer_id);
create index if not exists idx_sav_office on public.savings_transactions(office_id);
create index if not exists idx_sav_status on public.savings_transactions(status);

create index if not exists idx_pay_farmer on public.payments(farmer_id);
create index if not exists idx_pay_office on public.payments(office_id);
create index if not exists idx_pay_status on public.payments(status);
create index if not exists idx_pay_created on public.payments(created_at);

create index if not exists idx_audit_office on public.audit_logs(office_id);
create index if not exists idx_audit_user on public.audit_logs(user_id);
create index if not exists idx_audit_entity on public.audit_logs(entity, entity_id);
create index if not exists idx_audit_created on public.audit_logs(created_at);
