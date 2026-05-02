-- =====================================================================
-- ACCOUNTING SYSTEM: Chart of Accounts + Double-Entry Ledger
-- =====================================================================

-- ---------- Account type enum ----------
do $$ begin
  create type public.account_type as enum ('asset','liability','income','expense','equity');
exception when duplicate_object then null; end $$;

-- ---------- Accounts (Chart of Accounts) ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_bn text,
  type public.account_type not null,
  parent_id uuid references public.accounts(id) on delete set null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_type on public.accounts(type);
create index if not exists idx_accounts_parent on public.accounts(parent_id);

drop trigger if exists trg_accounts_touch on public.accounts;
create trigger trg_accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();

alter table public.accounts enable row level security;

drop policy if exists "auth read accounts" on public.accounts;
create policy "auth read accounts" on public.accounts
  for select to authenticated using (true);

drop policy if exists "super admin manage accounts" on public.accounts;
create policy "super admin manage accounts" on public.accounts
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- ---------- Ledger entries ----------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  account_id uuid not null references public.accounts(id) on delete restrict,
  debit numeric not null default 0,
  credit numeric not null default 0,
  reference_type text,
  reference_id uuid,
  description text,
  office_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_account on public.ledger_entries(account_id);
create index if not exists idx_ledger_date on public.ledger_entries(entry_date);
create index if not exists idx_ledger_ref on public.ledger_entries(reference_type, reference_id);
create index if not exists idx_ledger_office on public.ledger_entries(office_id);

alter table public.ledger_entries enable row level security;

drop policy if exists "office read ledger" on public.ledger_entries;
create policy "office read ledger" on public.ledger_entries
  for select to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or office_id = public.current_user_office()
    or office_id is null
  );

-- Inserts only happen via SECURITY DEFINER triggers; allow super_admin manual journal too
drop policy if exists "super admin insert ledger" on public.ledger_entries;
create policy "super admin insert ledger" on public.ledger_entries
  for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin'));

drop policy if exists "super admin update ledger" on public.ledger_entries;
create policy "super admin update ledger" on public.ledger_entries
  for update to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

drop policy if exists "super admin delete ledger" on public.ledger_entries;
create policy "super admin delete ledger" on public.ledger_entries
  for delete to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

-- ---------- Validation: each line must be debit XOR credit, non-negative ----------
create or replace function public.validate_ledger_entry()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(new.debit,0) < 0 or coalesce(new.credit,0) < 0 then
    raise exception 'Ledger debit/credit must be non-negative';
  end if;
  if (coalesce(new.debit,0) = 0 and coalesce(new.credit,0) = 0)
     or (coalesce(new.debit,0) > 0 and coalesce(new.credit,0) > 0) then
    raise exception 'Ledger entry must have either debit OR credit (not both, not neither)';
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_ledger on public.ledger_entries;
create trigger trg_validate_ledger
  before insert or update on public.ledger_entries
  for each row execute function public.validate_ledger_entry();

-- =====================================================================
-- Seed standard Chart of Accounts
-- =====================================================================
insert into public.accounts (code, name, name_bn, type, is_system) values
  -- Assets
  ('1010','Cash in Hand','নগদ',                  'asset', true),
  ('1020','Bank Account','ব্যাংক হিসাব',         'asset', true),
  ('1030','Savings Balance','সঞ্চয় ব্যালেন্স',  'asset', true),
  ('1040','Loan Receivable','ঋণ প্রাপ্য',        'asset', true),
  ('1050','Irrigation Receivable','সেচ প্রাপ্য', 'asset', true),
  -- Liabilities
  ('2010','Member Savings Payable','সদস্য সঞ্চয় প্রদেয়', 'liability', true),
  ('2020','Loan Payable','ঋণ প্রদেয়',                    'liability', true),
  -- Income
  ('4010','Irrigation Income','সেচ আয়',           'income', true),
  ('4020','Bigha Rent Income','বিঘা ভাড়া আয়',   'income', true),
  ('4030','Pond Income','পুকুর আয়',               'income', true),
  ('4040','Crop Sales Income','ফসল বিক্রয় আয়',  'income', true),
  ('4050','Scrap Sales','ভাংড়ি বিক্রয়',          'income', true),
  ('4060','Donation','অনুদান',                     'income', true),
  ('4090','Other Income','অন্যান্য আয়',           'income', true),
  -- Expenses
  ('5010','Maintenance Expense','রক্ষণাবেক্ষণ খরচ', 'expense', true),
  ('5020','Electricity Expense','বিদ্যুৎ খরচ',       'expense', true),
  ('5030','Salary Expense','বেতন খরচ',                'expense', true),
  ('5040','Repair Expense','মেরামত খরচ',              'expense', true),
  ('5090','Other Expense','অন্যান্য খরচ',             'expense', true)
on conflict (code) do nothing;

-- ---------- Helper: account id by code ----------
create or replace function public._acct(_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.accounts where code = _code limit 1;
$$;

revoke execute on function public._acct(text) from public, anon, authenticated;

-- ---------- Helper: post a balanced pair ----------
create or replace function public._post_pair(
  _date date, _debit_acct uuid, _credit_acct uuid, _amount numeric,
  _ref_type text, _ref_id uuid, _desc text, _office uuid, _user uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if _amount is null or _amount <= 0 then return; end if;
  if _debit_acct is null or _credit_acct is null then return; end if;
  insert into public.ledger_entries(entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
    values (_date, _debit_acct, _amount, 0, _ref_type, _ref_id, _desc, _office, _user);
  insert into public.ledger_entries(entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
    values (_date, _credit_acct, 0, _amount, _ref_type, _ref_id, _desc, _office, _user);
end $$;

revoke execute on function public._post_pair(date,uuid,uuid,numeric,text,uuid,text,uuid,uuid) from public, anon, authenticated;

-- ---------- Helper: clear existing entries for a reference ----------
create or replace function public._clear_ref(_ref_type text, _ref_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.ledger_entries where reference_type = _ref_type and reference_id = _ref_id;
$$;

revoke execute on function public._clear_ref(text,uuid) from public, anon, authenticated;

-- =====================================================================
-- AUTO-POSTING TRIGGERS
-- =====================================================================

-- ---------- Savings ----------
create or replace function public.post_savings_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare cash uuid; payable uuid;
begin
  cash    := public._acct('1010');
  payable := public._acct('2010');
  if TG_OP = 'DELETE' then
    perform public._clear_ref('savings', OLD.id);
    return OLD;
  end if;
  perform public._clear_ref('savings', NEW.id);
  if NEW.status = 'approved' then
    if NEW.type = 'deposit' then
      perform public._post_pair(NEW.txn_date, cash, payable, NEW.amount,
        'savings', NEW.id, 'Savings deposit', NEW.office_id, NEW.created_by);
    elsif NEW.type = 'withdraw' then
      perform public._post_pair(NEW.txn_date, payable, cash, NEW.amount,
        'savings', NEW.id, 'Savings withdrawal', NEW.office_id, NEW.created_by);
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_post_savings on public.savings_transactions;
create trigger trg_post_savings
  after insert or update or delete on public.savings_transactions
  for each row execute function public.post_savings_ledger();

-- ---------- Loan disbursement (when approved) ----------
create or replace function public.post_loan_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare cash uuid; receivable uuid;
begin
  cash       := public._acct('1010');
  receivable := public._acct('1040');
  if TG_OP = 'DELETE' then
    perform public._clear_ref('loan', OLD.id);
    return OLD;
  end if;
  perform public._clear_ref('loan', NEW.id);
  if NEW.status in ('approved','paid') then
    perform public._post_pair(NEW.issued_on, receivable, cash, NEW.principal,
      'loan', NEW.id, 'Loan disbursed', NEW.office_id, NEW.created_by);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_post_loans on public.loans;
create trigger trg_post_loans
  after insert or update or delete on public.loans
  for each row execute function public.post_loan_ledger();

-- ---------- Loan payment ----------
create or replace function public.post_loan_payment_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare cash uuid; receivable uuid;
begin
  cash       := public._acct('1010');
  receivable := public._acct('1040');
  if TG_OP = 'DELETE' then
    perform public._clear_ref('loan_payment', OLD.id);
    return OLD;
  end if;
  perform public._clear_ref('loan_payment', NEW.id);
  perform public._post_pair(NEW.paid_on, cash, receivable, NEW.amount,
    'loan_payment', NEW.id, 'Loan repayment', NEW.office_id, NEW.collected_by);
  return NEW;
end $$;

drop trigger if exists trg_post_loan_payments on public.loan_payments;
create trigger trg_post_loan_payments
  after insert or update or delete on public.loan_payments
  for each row execute function public.post_loan_payment_ledger();

-- ---------- Irrigation collection (post the paid_amount as income) ----------
create or replace function public.post_irrigation_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare cash uuid; income uuid;
begin
  cash   := public._acct('1010');
  income := public._acct('4010');
  if TG_OP = 'DELETE' then
    perform public._clear_ref('irrigation', OLD.id);
    return OLD;
  end if;
  perform public._clear_ref('irrigation', NEW.id);
  if coalesce(NEW.paid_amount,0) > 0 then
    perform public._post_pair(NEW.entry_date, cash, income, NEW.paid_amount,
      'irrigation', NEW.id, 'Irrigation collection', NEW.office_id, NEW.created_by);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_post_irrigation on public.irrigation_charges;
create trigger trg_post_irrigation
  after insert or update or delete on public.irrigation_charges
  for each row execute function public.post_irrigation_ledger();

-- ---------- Expenses ----------
create or replace function public.post_expense_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare cash uuid; expense_acct uuid; code text;
begin
  cash := public._acct('1010');
  -- Map expense.head to account code (case-insensitive)
  code := case lower(coalesce(NEW.head,''))
    when 'maintenance' then '5010'
    when 'electricity' then '5020'
    when 'salary'      then '5030'
    when 'repair'      then '5040'
    else '5090' end;
  expense_acct := public._acct(code);

  if TG_OP = 'DELETE' then
    perform public._clear_ref('expense', OLD.id);
    return OLD;
  end if;
  perform public._clear_ref('expense', NEW.id);
  perform public._post_pair(NEW.expense_date, expense_acct, cash, NEW.amount,
    'expense', NEW.id, coalesce(NEW.note, NEW.head), NEW.office_id, NEW.created_by);
  return NEW;
end $$;

drop trigger if exists trg_post_expenses on public.expenses;
create trigger trg_post_expenses
  after insert or update or delete on public.expenses
  for each row execute function public.post_expense_ledger();

-- =====================================================================
-- BACKFILL existing data
-- =====================================================================
do $$
declare r record;
begin
  -- savings
  for r in select * from public.savings_transactions where status='approved' loop
    perform public.post_savings_ledger() from (select r.*) s; -- noop fallback
  end loop;
exception when others then null;
end $$;

-- Direct backfill (safer than re-firing triggers)
delete from public.ledger_entries
  where reference_type in ('savings','loan','loan_payment','irrigation','expense');

-- savings
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select s.txn_date, public._acct('1010'), s.amount, 0, 'savings', s.id, 'Savings deposit', s.office_id, s.created_by
  from public.savings_transactions s where s.status='approved' and s.type='deposit';
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select s.txn_date, public._acct('2010'), 0, s.amount, 'savings', s.id, 'Savings deposit', s.office_id, s.created_by
  from public.savings_transactions s where s.status='approved' and s.type='deposit';
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select s.txn_date, public._acct('2010'), s.amount, 0, 'savings', s.id, 'Savings withdrawal', s.office_id, s.created_by
  from public.savings_transactions s where s.status='approved' and s.type='withdraw';
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select s.txn_date, public._acct('1010'), 0, s.amount, 'savings', s.id, 'Savings withdrawal', s.office_id, s.created_by
  from public.savings_transactions s where s.status='approved' and s.type='withdraw';

-- loans (disbursement)
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select l.issued_on, public._acct('1040'), l.principal, 0, 'loan', l.id, 'Loan disbursed', l.office_id, l.created_by
  from public.loans l where l.status in ('approved','paid') and coalesce(l.principal,0) > 0;
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select l.issued_on, public._acct('1010'), 0, l.principal, 'loan', l.id, 'Loan disbursed', l.office_id, l.created_by
  from public.loans l where l.status in ('approved','paid') and coalesce(l.principal,0) > 0;

-- loan payments
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select lp.paid_on, public._acct('1010'), lp.amount, 0, 'loan_payment', lp.id, 'Loan repayment', lp.office_id, lp.collected_by
  from public.loan_payments lp where coalesce(lp.amount,0) > 0;
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select lp.paid_on, public._acct('1040'), 0, lp.amount, 'loan_payment', lp.id, 'Loan repayment', lp.office_id, lp.collected_by
  from public.loan_payments lp where coalesce(lp.amount,0) > 0;

-- irrigation
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select i.entry_date, public._acct('1010'), i.paid_amount, 0, 'irrigation', i.id, 'Irrigation collection', i.office_id, i.created_by
  from public.irrigation_charges i where coalesce(i.paid_amount,0) > 0;
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select i.entry_date, public._acct('4010'), 0, i.paid_amount, 'irrigation', i.id, 'Irrigation collection', i.office_id, i.created_by
  from public.irrigation_charges i where coalesce(i.paid_amount,0) > 0;

-- expenses
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select e.expense_date,
  public._acct(case lower(coalesce(e.head,''))
    when 'maintenance' then '5010' when 'electricity' then '5020'
    when 'salary' then '5030' when 'repair' then '5040' else '5090' end),
  e.amount, 0, 'expense', e.id, coalesce(e.note,e.head), e.office_id, e.created_by
  from public.expenses e where coalesce(e.amount,0) > 0;
insert into public.ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
select e.expense_date, public._acct('1010'), 0, e.amount, 'expense', e.id, coalesce(e.note,e.head), e.office_id, e.created_by
  from public.expenses e where coalesce(e.amount,0) > 0;