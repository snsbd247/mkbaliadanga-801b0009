-- Loan delay-fee settings (office-scoped)
CREATE TABLE IF NOT EXISTS public.loan_delay_fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  mode text NOT NULL DEFAULT 'flat' CHECK (mode IN ('flat','percent')),
  value numeric NOT NULL DEFAULT 0,
  grace_days integer NOT NULL DEFAULT 0,
  auto_apply boolean NOT NULL DEFAULT true,
  allow_partial_installment boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id)
);

ALTER TABLE public.loan_delay_fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read loan_dfs"
  ON public.loan_delay_fee_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "admin manage loan_dfs"
  ON public.loan_delay_fee_settings FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL));

-- Loan installment delay-fee audit
CREATE TABLE IF NOT EXISTS public.loan_installment_delay_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL,
  loan_id uuid NOT NULL,
  payment_id uuid,
  original_amount numeric NOT NULL DEFAULT 0,
  modified_amount numeric NOT NULL DEFAULT 0,
  reason text,
  changed_by uuid,
  office_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_installment_delay_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read lida"
  ON public.loan_installment_delay_audit FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "auth insert lida"
  ON public.loan_installment_delay_audit FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid() OR changed_by IS NULL);

CREATE POLICY "super delete lida"
  ON public.loan_installment_delay_audit FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan_due
  ON public.loan_installments (loan_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_loan_installments_status
  ON public.loan_installments (status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_paid_on
  ON public.loan_payments (paid_on);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan
  ON public.loan_payments (loan_id);

-- updated_at trigger for settings
CREATE OR REPLACE FUNCTION public.touch_loan_dfs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_dfs_updated_at ON public.loan_delay_fee_settings;
CREATE TRIGGER trg_loan_dfs_updated_at
  BEFORE UPDATE ON public.loan_delay_fee_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_loan_dfs_updated_at();