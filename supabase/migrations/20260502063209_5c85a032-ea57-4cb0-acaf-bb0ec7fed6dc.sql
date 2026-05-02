-- Period closing & retained summary
create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  office_id uuid references public.offices(id) on delete set null,
  total_debit numeric not null default 0,
  total_credit numeric not null default 0,
  total_income numeric not null default 0,
  total_expense numeric not null default 0,
  net_income numeric not null default 0,
  cash_in numeric not null default 0,
  cash_out numeric not null default 0,
  closing_balance_snapshot jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_start, period_end, office_id)
);

create index if not exists idx_periods_range on public.accounting_periods (period_start, period_end);
create index if not exists idx_periods_office on public.accounting_periods (office_id);

alter table public.accounting_periods enable row level security;

drop policy if exists "office read periods" on public.accounting_periods;
create policy "office read periods" on public.accounting_periods
  for select to authenticated
  using (has_role(auth.uid(), 'super_admin'::app_role) or office_id = current_user_office() or office_id is null);

drop policy if exists "committee manage periods" on public.accounting_periods;
create policy "committee manage periods" on public.accounting_periods
  for all to authenticated
  using (is_committee_or_super(auth.uid()))
  with check (is_committee_or_super(auth.uid()));

create trigger trg_periods_touch before update on public.accounting_periods
  for each row execute function public.touch_updated_at();

-- RPC: compute period summary on the fly (used both for preview and for closing snapshot)
create or replace function public.compute_period_summary(_from date, _to date, _office uuid default null)
returns table(
  total_debit numeric,
  total_credit numeric,
  total_income numeric,
  total_expense numeric,
  net_income numeric,
  cash_in numeric,
  cash_out numeric,
  account_balances jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_balances jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'account_id', a.id,
    'code', a.code,
    'name', a.name,
    'type', a.type,
    'debit', coalesce(s.d,0),
    'credit', coalesce(s.c,0),
    'closing', case when a.type in ('asset','expense')
                    then coalesce(s.d,0) - coalesce(s.c,0)
                    else coalesce(s.c,0) - coalesce(s.d,0) end
  ) order by a.code), '[]'::jsonb)
  into v_balances
  from public.accounts a
  left join (
    select account_id, sum(debit) as d, sum(credit) as c
    from public.ledger_entries
    where entry_date between _from and _to
      and (_office is null or office_id = _office)
    group by account_id
  ) s on s.account_id = a.id;

  return query
  with led as (
    select a.type, le.debit, le.credit
    from public.ledger_entries le
    join public.accounts a on a.id = le.account_id
    where le.entry_date between _from and _to
      and (_office is null or le.office_id = _office)
  ),
  cash as (
    select coalesce(sum(le.debit),0) as d, coalesce(sum(le.credit),0) as c
    from public.ledger_entries le
    join public.accounts a on a.id = le.account_id
    where a.code = '1010'
      and le.entry_date between _from and _to
      and (_office is null or le.office_id = _office)
  )
  select
    coalesce(sum(debit),0)  as total_debit,
    coalesce(sum(credit),0) as total_credit,
    coalesce(sum(case when type='income' then credit-debit else 0 end),0) as total_income,
    coalesce(sum(case when type='expense' then debit-credit else 0 end),0) as total_expense,
    coalesce(sum(case when type='income' then credit-debit else 0 end),0)
      - coalesce(sum(case when type='expense' then debit-credit else 0 end),0) as net_income,
    (select d from cash) as cash_in,
    (select c from cash) as cash_out,
    v_balances as account_balances
  from led;
end;
$$;

-- RPC: close a period and store snapshot
create or replace function public.close_accounting_period(_from date, _to date, _office uuid default null, _note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sum record;
begin
  if not is_committee_or_super(auth.uid()) then
    raise exception 'Only committee or super admin can close a period';
  end if;
  if _to < _from then
    raise exception 'period_end must be >= period_start';
  end if;

  -- Refuse if any open period overlaps and is not this exact one
  if exists (
    select 1 from public.accounting_periods p
    where p.status = 'closed'
      and (_office is null and p.office_id is null or p.office_id = _office)
      and not (p.period_end < _from or p.period_start > _to)
      and not (p.period_start = _from and p.period_end = _to)
  ) then
    raise exception 'Overlapping closed period exists';
  end if;

  select * into v_sum from public.compute_period_summary(_from, _to, _office);

  insert into public.accounting_periods(
    period_start, period_end, status, closed_at, closed_by, office_id,
    total_debit, total_credit, total_income, total_expense, net_income,
    cash_in, cash_out, closing_balance_snapshot, note
  ) values (
    _from, _to, 'closed', now(), auth.uid(), _office,
    v_sum.total_debit, v_sum.total_credit, v_sum.total_income, v_sum.total_expense, v_sum.net_income,
    v_sum.cash_in, v_sum.cash_out, v_sum.account_balances, _note
  )
  on conflict (period_start, period_end, office_id)
  do update set
    status='closed', closed_at=now(), closed_by=auth.uid(),
    total_debit=excluded.total_debit, total_credit=excluded.total_credit,
    total_income=excluded.total_income, total_expense=excluded.total_expense,
    net_income=excluded.net_income, cash_in=excluded.cash_in, cash_out=excluded.cash_out,
    closing_balance_snapshot=excluded.closing_balance_snapshot, note=excluded.note
  returning id into v_id;

  return v_id;
end;
$$;

-- Reopen a closed period (super admin only)
create or replace function public.reopen_accounting_period(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_role(auth.uid(), 'super_admin'::app_role) then
    raise exception 'Only super admin can reopen a period';
  end if;
  update public.accounting_periods
    set status='open', closed_at=null, closed_by=null
    where id = _id;
end;
$$;