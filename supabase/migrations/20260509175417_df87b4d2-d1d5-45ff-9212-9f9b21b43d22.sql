-- Phase 1: Irrigation payment refactor — foundations

-- 1.1 irrigation_due_promises
CREATE TABLE IF NOT EXISTS public.irrigation_due_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  farmer_id uuid NOT NULL,
  payment_id uuid,
  previous_due_amount numeric NOT NULL DEFAULT 0,
  promise_date date NOT NULL,
  remarks text,
  approved_by uuid,
  status text NOT NULL DEFAULT 'pending',
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idp_status_chk CHECK (status IN ('pending','fulfilled','overdue','broken'))
);
CREATE INDEX IF NOT EXISTS idx_idp_farmer ON public.irrigation_due_promises(farmer_id);
CREATE INDEX IF NOT EXISTS idx_idp_office ON public.irrigation_due_promises(office_id);
CREATE INDEX IF NOT EXISTS idx_idp_status ON public.irrigation_due_promises(status);
ALTER TABLE public.irrigation_due_promises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read idp" ON public.irrigation_due_promises;
CREATE POLICY "office read idp" ON public.irrigation_due_promises
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (office_id = current_user_office()));

DROP POLICY IF EXISTS "admin insert idp" ON public.irrigation_due_promises;
CREATE POLICY "admin insert idp" ON public.irrigation_due_promises
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_super(auth.uid())
    AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL)
  );

DROP POLICY IF EXISTS "admin update idp" ON public.irrigation_due_promises;
CREATE POLICY "admin update idp" ON public.irrigation_due_promises
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "super delete idp" ON public.irrigation_due_promises;
CREATE POLICY "super delete idp" ON public.irrigation_due_promises
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_idp_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_idp_touch ON public.irrigation_due_promises;
CREATE TRIGGER trg_idp_touch BEFORE UPDATE ON public.irrigation_due_promises
  FOR EACH ROW EXECUTE FUNCTION public.tg_idp_touch();

-- 1.2 extend irrigation_invoice_payments
ALTER TABLE public.irrigation_invoice_payments
  ADD COLUMN IF NOT EXISTS current_invoice_collected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_due_collected   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_fee_original       numeric,
  ADD COLUMN IF NOT EXISTS delay_fee_override_reason text;

-- 1.3 irrigation_delay_fee_audit
CREATE TABLE IF NOT EXISTS public.irrigation_delay_fee_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  payment_id uuid,
  original_amount numeric NOT NULL DEFAULT 0,
  modified_amount numeric NOT NULL DEFAULT 0,
  reason text,
  changed_by uuid,
  office_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_idfa_invoice ON public.irrigation_delay_fee_audit(invoice_id);
CREATE INDEX IF NOT EXISTS idx_idfa_office ON public.irrigation_delay_fee_audit(office_id);
ALTER TABLE public.irrigation_delay_fee_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read idfa" ON public.irrigation_delay_fee_audit;
CREATE POLICY "office read idfa" ON public.irrigation_delay_fee_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office());

DROP POLICY IF EXISTS "auth insert idfa" ON public.irrigation_delay_fee_audit;
CREATE POLICY "auth insert idfa" ON public.irrigation_delay_fee_audit
  FOR INSERT TO authenticated
  WITH CHECK ((changed_by = auth.uid()) OR (changed_by IS NULL));

-- 1.4 ensure split system accounts exist (idempotent)
INSERT INTO public.accounts (code, name, name_bn, type, is_system, is_active)
SELECT * FROM (VALUES
  ('IRR-INCOME',   'Irrigation Income',         'সেচ আয়',            'income'::public.account_type, true, true),
  ('IRR-PREV-DUE', 'Previous Due Collection',   'পূর্বের বকেয়া আদায়', 'income'::public.account_type, true, true),
  ('IRR-DELAY',    'Delay Fee Income',          'বিলম্ব ফি আয়',      'income'::public.account_type, true, true),
  ('IRR-MAINT',    'Maintenance Income',        'রক্ষণাবেক্ষণ আয়',  'income'::public.account_type, true, true),
  ('IRR-CANAL',    'Canal/Nala Income',         'ক্যানেল/নালা আয়',  'income'::public.account_type, true, true)
) AS v(code, name, name_bn, type, is_system, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.code = v.code);