drop view if exists public.ledger_entries_view;
create view public.ledger_entries_view
with (security_invoker = true) as
select le.*, a.code as account_code, a.name as account_name, a.type as account_type,
       o.name as office_name
from public.ledger_entries le
left join public.accounts a on a.id = le.account_id
left join public.offices o on o.id = le.office_id;

grant select on public.ledger_entries_view to authenticated;