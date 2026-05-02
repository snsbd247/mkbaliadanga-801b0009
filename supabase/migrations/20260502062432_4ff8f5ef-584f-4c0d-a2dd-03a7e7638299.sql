-- =====================================================================
-- 1. Fiscal year config
-- =====================================================================
alter table public.company_settings
  add column if not exists fiscal_year_start_month smallint not null default 7
    check (fiscal_year_start_month between 1 and 12);

-- =====================================================================
-- 2. Manual journal entries
-- =====================================================================
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  reference text,
  description text,
  office_id uuid,
  posted boolean not null default false,
  posted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  debit numeric not null default 0,
  credit numeric not null default 0,
  description text,
  position int not null default 0
);

create index if not exists idx_jel_journal on public.journal_entry_lines(journal_id);
create index if not exists idx_jel_account on public.journal_entry_lines(account_id);

drop trigger if exists trg_journal_touch on public.journal_entries;
create trigger trg_journal_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;

drop policy if exists "office read journals" on public.journal_entries;
create policy "office read journals" on public.journal_entries
  for select to authenticated using (
    public.has_role(auth.uid(),'super_admin')
    or office_id = public.current_user_office()
    or office_id is null
  );

drop policy if exists "committee manage journals" on public.journal_entries;
create policy "committee manage journals" on public.journal_entries
  for all to authenticated
  using (public.is_committee_or_super(auth.uid()))
  with check (public.is_committee_or_super(auth.uid()));

drop policy if exists "office read journal lines" on public.journal_entry_lines;
create policy "office read journal lines" on public.journal_entry_lines
  for select to authenticated using (
    exists(select 1 from public.journal_entries j where j.id = journal_id
      and (public.has_role(auth.uid(),'super_admin')
        or j.office_id = public.current_user_office()
        or j.office_id is null))
  );

drop policy if exists "committee manage journal lines" on public.journal_entry_lines;
create policy "committee manage journal lines" on public.journal_entry_lines
  for all to authenticated
  using (public.is_committee_or_super(auth.uid()))
  with check (public.is_committee_or_super(auth.uid()));

-- Trigger: when a journal is marked posted, write balanced ledger entries
create or replace function public.post_journal_to_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_debit numeric; v_credit numeric; r record;
begin
  if TG_OP = 'DELETE' then
    perform public._clear_ref('journal', OLD.id);
    return OLD;
  end if;

  -- Always clear previous postings for this journal
  perform public._clear_ref('journal', NEW.id);

  if not NEW.posted then
    return NEW;
  end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into v_debit, v_credit
    from public.journal_entry_lines where journal_id = NEW.id;

  if v_debit = 0 and v_credit = 0 then
    raise exception 'Journal % has no lines', NEW.id;
  end if;
  if abs(v_debit - v_credit) > 0.01 then
    raise exception 'Journal % is not balanced (debit %, credit %)', NEW.id, v_debit, v_credit;
  end if;

  for r in select * from public.journal_entry_lines where journal_id = NEW.id order by position loop
    insert into public.ledger_entries(entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
      values (NEW.entry_date, r.account_id, r.debit, r.credit, 'journal', NEW.id,
              coalesce(r.description, NEW.description, NEW.reference), NEW.office_id, NEW.created_by);
  end loop;

  NEW.posted_at := now();
  return NEW;
end $$;

drop trigger if exists trg_post_journal on public.journal_entries;
create trigger trg_post_journal
  before update or delete on public.journal_entries
  for each row execute function public.post_journal_to_ledger();

-- =====================================================================
-- 3. Loan payment approval
-- =====================================================================
do $$ begin
  create type public.loan_payment_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

alter table public.loan_payments
  add column if not exists status public.loan_payment_status not null default 'approved',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz;

-- Update loan payment ledger trigger: post only when approved
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
  if NEW.status = 'approved' then
    perform public._post_pair(NEW.paid_on, cash, receivable, NEW.amount,
      'loan_payment', NEW.id, 'Loan repayment', NEW.office_id, NEW.collected_by);
  end if;
  return NEW;
end $$;

-- =====================================================================
-- 4. Audit triggers (covering: savings, loans, loan_payments, irrigation, journals)
-- =====================================================================
drop trigger if exists trg_audit_savings on public.savings_transactions;
create trigger trg_audit_savings after insert or update or delete on public.savings_transactions
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_loans on public.loans;
create trigger trg_audit_loans after insert or update or delete on public.loans
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_loan_payments on public.loan_payments;
create trigger trg_audit_loan_payments after insert or update or delete on public.loan_payments
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_irrigation on public.irrigation_charges;
create trigger trg_audit_irrigation after insert or update or delete on public.irrigation_charges
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_journals on public.journal_entries;
create trigger trg_audit_journals after insert or update or delete on public.journal_entries
  for each row execute function public.audit_trigger();

-- =====================================================================
-- 5. Ledger view (joined for filtered reads)
-- =====================================================================
create or replace view public.ledger_entries_view as
select le.*, a.code as account_code, a.name as account_name, a.type as account_type,
       o.name as office_name
from public.ledger_entries le
left join public.accounts a on a.id = le.account_id
left join public.offices o on o.id = le.office_id;

grant select on public.ledger_entries_view to authenticated;

-- =====================================================================
-- 6. Integrity helpers (read-only, returning rows for the UI)
-- =====================================================================
create or replace function public.ledger_unbalanced_refs()
returns table(reference_type text, reference_id uuid, total_debit numeric, total_credit numeric, diff numeric)
language sql stable security definer set search_path = public as $$
  select reference_type, reference_id,
         sum(debit) as total_debit, sum(credit) as total_credit,
         sum(debit) - sum(credit) as diff
  from public.ledger_entries
  where reference_type is not null and reference_id is not null
  group by reference_type, reference_id
  having abs(sum(debit) - sum(credit)) > 0.01;
$$;

create or replace function public.ledger_orphan_refs()
returns table(reference_type text, reference_id uuid, entry_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with refs as (
    select reference_type, reference_id, count(*) as c
    from public.ledger_entries
    where reference_type is not null and reference_id is not null
    group by reference_type, reference_id
  )
  select r.reference_type, r.reference_id, r.c
  from refs r
  where (r.reference_type='savings'      and not exists(select 1 from public.savings_transactions s where s.id = r.reference_id))
     or (r.reference_type='loan'         and not exists(select 1 from public.loans l where l.id = r.reference_id))
     or (r.reference_type='loan_payment' and not exists(select 1 from public.loan_payments lp where lp.id = r.reference_id))
     or (r.reference_type='irrigation'   and not exists(select 1 from public.irrigation_charges i where i.id = r.reference_id))
     or (r.reference_type='expense'      and not exists(select 1 from public.expenses e where e.id = r.reference_id))
     or (r.reference_type='journal'      and not exists(select 1 from public.journal_entries j where j.id = r.reference_id));
end $$;

grant execute on function public.ledger_unbalanced_refs() to authenticated;
grant execute on function public.ledger_orphan_refs() to authenticated;