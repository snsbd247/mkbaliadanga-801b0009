
-- Function: previous unpaid for (farmer, land) excluding given season
create or replace function public.get_previous_due(_farmer uuid, _land uuid, _exclude_season uuid)
returns numeric
language sql stable security definer set search_path=public
as $$
  select coalesce(sum(due_amount),0) from public.irrigation_charges
  where farmer_id=_farmer and land_id=_land
    and (_exclude_season is null or season_id <> _exclude_season);
$$;

-- Function: compute penalty per company_settings on a (due, days_overdue) basis
create or replace function public.compute_penalty(_base numeric, _days_overdue int)
returns numeric
language plpgsql stable security definer set search_path=public
as $$
declare s record; p numeric := 0;
begin
  select penalty_type, penalty_value, penalty_grace_days into s from public.company_settings where id=1;
  if s is null then return 0; end if;
  if _days_overdue <= coalesce(s.penalty_grace_days,0) then return 0; end if;
  if s.penalty_type = 'flat' then
    p := coalesce(s.penalty_value,0);
  elsif s.penalty_type = 'percent' then
    p := round((_base * coalesce(s.penalty_value,0) / 100.0)::numeric, 2);
  end if;
  return greatest(p,0);
end $$;

-- Auto-fill previous_due_brought + penalty on insert when 0
create or replace function public.fill_irrigation_arrears()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_prev numeric; v_days int; v_pen numeric;
begin
  if TG_OP='INSERT' then
    if coalesce(new.previous_due_brought,0)=0 then
      v_prev := public.get_previous_due(new.farmer_id, new.land_id, new.season_id);
      new.previous_due_brought := v_prev;
    end if;
    if coalesce(new.penalty_amount,0)=0 and new.previous_due_brought > 0 then
      v_days := greatest(0, (current_date - new.entry_date)::int);
      -- penalty only if there's existing overdue prev due; treat as days since entry_date
      v_pen := public.compute_penalty(new.previous_due_brought, coalesce(v_days,0));
      new.penalty_amount := v_pen;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_irrigation_arrears on public.irrigation_charges;
create trigger trg_irrigation_arrears
before insert on public.irrigation_charges
for each row execute function public.fill_irrigation_arrears();
