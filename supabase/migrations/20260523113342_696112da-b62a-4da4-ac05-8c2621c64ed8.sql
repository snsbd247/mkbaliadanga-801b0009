
-- E3: Monthly depreciation auto-post batch RPC
CREATE OR REPLACE FUNCTION public.run_monthly_depreciation_batch(_period_month date)
RETURNS TABLE(asset_id uuid, schedule_id uuid, journal_entry_id uuid, depreciation numeric, status text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pm date := date_trunc('month', _period_month)::date;
  is_service boolean := (auth.uid() IS NULL); -- service role bypass
  cfg public.asset_depreciation_settings%ROWTYPE;
  ast public.assets%ROWTYPE;
  last_row public.asset_depreciation_schedule%ROWTYPE;
  exist_row public.asset_depreciation_schedule%ROWTYPE;
  opening numeric; accum numeric; cost numeric; salvage numeric; remaining numeric;
  dep numeric; closing numeric;
  sched_id uuid; je_id uuid;
  exp_acct uuid; accum_acct uuid;
BEGIN
  IF NOT is_service AND NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR cfg IN SELECT * FROM public.asset_depreciation_settings WHERE is_active = true LOOP
    BEGIN
      SELECT * INTO ast FROM public.assets WHERE id = cfg.asset_id AND deleted_at IS NULL;
      IF NOT FOUND THEN CONTINUE; END IF;
      IF cfg.start_on > pm THEN CONTINUE; END IF;

      -- Skip if already posted for this period
      SELECT * INTO exist_row FROM public.asset_depreciation_schedule
       WHERE asset_id = cfg.asset_id AND period_month = pm;
      IF FOUND AND exist_row.status = 'posted' THEN
        asset_id := cfg.asset_id; schedule_id := exist_row.id;
        journal_entry_id := exist_row.journal_entry_id; depreciation := exist_row.depreciation_amount;
        status := 'already_posted'; message := NULL; RETURN NEXT; CONTINUE;
      END IF;

      cost := COALESCE(ast.purchase_price, 0);
      salvage := COALESCE(cfg.salvage_value, 0);

      -- Opening = last closing prior to pm, else cost
      SELECT * INTO last_row FROM public.asset_depreciation_schedule
       WHERE asset_id = cfg.asset_id AND period_month < pm
       ORDER BY period_month DESC LIMIT 1;
      IF FOUND THEN
        opening := last_row.closing_book_value; accum := last_row.accumulated_depreciation;
      ELSE
        opening := cost; accum := 0;
      END IF;

      remaining := GREATEST(0, opening - salvage);
      IF remaining <= 0 THEN
        dep := 0;
      ELSIF cfg.method = 'straight_line' THEN
        dep := LEAST(remaining, ROUND((cost - salvage) / GREATEST(1, cfg.useful_life_months), 2));
      ELSE
        dep := LEAST(remaining, ROUND(opening * (COALESCE(cfg.wdv_rate_pct,0)/100.0) / 12.0, 2));
      END IF;
      closing := ROUND(opening - dep, 2);

      INSERT INTO public.asset_depreciation_schedule
        (asset_id, office_id, period_month, opening_book_value,
         depreciation_amount, accumulated_depreciation, closing_book_value, status)
      VALUES (cfg.asset_id, cfg.office_id, pm, opening, dep, ROUND(accum+dep,2), closing,
              CASE WHEN dep > 0 THEN 'pending' ELSE 'skipped' END)
      ON CONFLICT (asset_id, period_month) DO UPDATE
        SET opening_book_value = EXCLUDED.opening_book_value,
            depreciation_amount = EXCLUDED.depreciation_amount,
            accumulated_depreciation = EXCLUDED.accumulated_depreciation,
            closing_book_value = EXCLUDED.closing_book_value,
            status = CASE WHEN public.asset_depreciation_schedule.status='posted'
                          THEN public.asset_depreciation_schedule.status ELSE EXCLUDED.status END
      RETURNING id INTO sched_id;

      IF dep <= 0 THEN
        asset_id := cfg.asset_id; schedule_id := sched_id; journal_entry_id := NULL;
        depreciation := 0; status := 'skipped'; message := NULL; RETURN NEXT; CONTINUE;
      END IF;

      exp_acct := public._acct(COALESCE(cfg.expense_account_code, '5410'));
      accum_acct := public._acct(COALESCE(cfg.accum_account_code, '1610'));
      IF exp_acct IS NULL OR accum_acct IS NULL THEN
        asset_id := cfg.asset_id; schedule_id := sched_id; journal_entry_id := NULL;
        depreciation := dep; status := 'error'; message := 'Depreciation accounts missing'; RETURN NEXT; CONTINUE;
      END IF;

      INSERT INTO public.journal_entries (entry_date, reference, description, office_id, posted, posted_at, created_by)
      VALUES (pm, 'ASSET-DEP-'||substr(sched_id::text,1,8),
              'Depreciation '||COALESCE(ast.asset_code,'')||' '||to_char(pm,'YYYY-MM'),
              cfg.office_id, true, now(), auth.uid())
      RETURNING id INTO je_id;

      INSERT INTO public.journal_entry_lines (journal_id, account_id, debit, credit, position, description) VALUES
        (je_id, exp_acct, dep, 0, 0, 'Depreciation expense'),
        (je_id, accum_acct, 0, dep, 1, 'Accumulated depreciation');

      UPDATE public.asset_depreciation_schedule
         SET status='posted', journal_entry_id=je_id, posted_at=now(), posted_by=auth.uid()
       WHERE id=sched_id;

      asset_id := cfg.asset_id; schedule_id := sched_id; journal_entry_id := je_id;
      depreciation := dep; status := 'posted'; message := NULL; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      asset_id := cfg.asset_id; schedule_id := NULL; journal_entry_id := NULL;
      depreciation := 0; status := 'error'; message := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
  RETURN;
END $$;

GRANT EXECUTE ON FUNCTION public.run_monthly_depreciation_batch(date) TO authenticated, service_role;
