
-- Depreciation method enum
DO $$ BEGIN
  CREATE TYPE public.asset_depreciation_method AS ENUM ('straight_line', 'wdv');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_depreciation_status AS ENUM ('pending', 'posted', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings per asset (one row each)
CREATE TABLE IF NOT EXISTS public.asset_depreciation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  office_id uuid,
  method public.asset_depreciation_method NOT NULL DEFAULT 'straight_line',
  useful_life_months int NOT NULL DEFAULT 60 CHECK (useful_life_months > 0),
  salvage_value numeric NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  wdv_rate_pct numeric NOT NULL DEFAULT 0 CHECK (wdv_rate_pct >= 0 AND wdv_rate_pct <= 100),
  start_on date NOT NULL DEFAULT CURRENT_DATE,
  expense_account_code text NOT NULL DEFAULT '5410',
  accum_account_code text NOT NULL DEFAULT '1610',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dep_settings_office ON public.asset_depreciation_settings(office_id);

-- Schedule rows (one per asset per month)
CREATE TABLE IF NOT EXISTS public.asset_depreciation_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  office_id uuid,
  period_month date NOT NULL,
  opening_book_value numeric NOT NULL DEFAULT 0,
  depreciation_amount numeric NOT NULL DEFAULT 0,
  accumulated_depreciation numeric NOT NULL DEFAULT 0,
  closing_book_value numeric NOT NULL DEFAULT 0,
  status public.asset_depreciation_status NOT NULL DEFAULT 'pending',
  journal_entry_id uuid,
  posted_at timestamptz,
  posted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_dep_sched_period ON public.asset_depreciation_schedule(period_month);
CREATE INDEX IF NOT EXISTS idx_dep_sched_office ON public.asset_depreciation_schedule(office_id);

-- Scan log
CREATE TABLE IF NOT EXISTS public.asset_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by uuid,
  office_id uuid,
  scanned_text text NOT NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  asset_code text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  source text NOT NULL DEFAULT 'camera'
);
CREATE INDEX IF NOT EXISTS idx_scan_logs_office_at ON public.asset_scan_logs(office_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_logs_asset ON public.asset_scan_logs(asset_id);

-- Touch updated_at
DROP TRIGGER IF EXISTS trg_dep_settings_touch ON public.asset_depreciation_settings;
CREATE TRIGGER trg_dep_settings_touch BEFORE UPDATE ON public.asset_depreciation_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.asset_depreciation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read dep_settings" ON public.asset_depreciation_settings;
CREATE POLICY "office read dep_settings" ON public.asset_depreciation_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
DROP POLICY IF EXISTS "office write dep_settings" ON public.asset_depreciation_settings;
CREATE POLICY "office write dep_settings" ON public.asset_depreciation_settings FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));

DROP POLICY IF EXISTS "office read dep_sched" ON public.asset_depreciation_schedule;
CREATE POLICY "office read dep_sched" ON public.asset_depreciation_schedule FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
DROP POLICY IF EXISTS "office write dep_sched" ON public.asset_depreciation_schedule;
CREATE POLICY "office write dep_sched" ON public.asset_depreciation_schedule FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));

DROP POLICY IF EXISTS "office read scan_logs" ON public.asset_scan_logs;
CREATE POLICY "office read scan_logs" ON public.asset_scan_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
DROP POLICY IF EXISTS "office insert scan_logs" ON public.asset_scan_logs;
CREATE POLICY "office insert scan_logs" ON public.asset_scan_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
DROP POLICY IF EXISTS "super delete scan_logs" ON public.asset_scan_logs;
CREATE POLICY "super delete scan_logs" ON public.asset_scan_logs FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role));

-- Seed depreciation expense account if missing
INSERT INTO public.accounts (code, name, type, is_active)
SELECT '5410', 'Depreciation Expense', 'expense', true
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE code = '5410');

-- RPC: post a depreciation journal pair and link to schedule row
CREATE OR REPLACE FUNCTION public.post_asset_depreciation_journal(_schedule_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.asset_depreciation_schedule%ROWTYPE;
  cfg public.asset_depreciation_settings%ROWTYPE;
  ast public.assets%ROWTYPE;
  exp_acct uuid; accum_acct uuid;
  je_id uuid;
BEGIN
  IF NOT is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT * INTO s FROM public.asset_depreciation_schedule WHERE id = _schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule row not found'; END IF;
  IF s.status = 'posted' THEN RETURN s.journal_entry_id; END IF;
  IF s.depreciation_amount <= 0 THEN
    UPDATE public.asset_depreciation_schedule SET status='skipped' WHERE id=_schedule_id;
    RETURN NULL;
  END IF;
  SELECT * INTO cfg FROM public.asset_depreciation_settings WHERE asset_id = s.asset_id;
  SELECT * INTO ast FROM public.assets WHERE id = s.asset_id;
  exp_acct := public._acct(COALESCE(cfg.expense_account_code, '5410'));
  accum_acct := public._acct(COALESCE(cfg.accum_account_code, '1610'));
  IF exp_acct IS NULL OR accum_acct IS NULL THEN
    RAISE EXCEPTION 'Depreciation accounts missing (expense or accumulated)';
  END IF;

  INSERT INTO public.journal_entries (entry_date, reference, description, office_id, posted, posted_at, created_by)
  VALUES (s.period_month, 'ASSET-DEP-'||substr(s.id::text,1,8),
          'Depreciation '||COALESCE(ast.asset_code,'')||' '||to_char(s.period_month,'YYYY-MM'),
          s.office_id, true, now(), auth.uid())
  RETURNING id INTO je_id;

  INSERT INTO public.journal_entry_lines (journal_id, account_id, debit, credit, position, description) VALUES
    (je_id, exp_acct, s.depreciation_amount, 0, 0, 'Depreciation expense'),
    (je_id, accum_acct, 0, s.depreciation_amount, 1, 'Accumulated depreciation');

  UPDATE public.asset_depreciation_schedule
     SET status='posted', journal_entry_id=je_id, posted_at=now(), posted_by=auth.uid()
   WHERE id=_schedule_id;

  RETURN je_id;
END $$;
