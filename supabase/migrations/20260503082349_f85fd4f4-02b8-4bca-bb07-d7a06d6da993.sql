-- ============================================================
-- Phase 1: Savings Plans + Loan Plans + Loan Installments
-- All additive. Does NOT modify existing tables' columns/logic.
-- ============================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.savings_installment_type AS ENUM ('daily','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.savings_maturity_type AS ENUM ('simple','compound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.loan_installment_type AS ENUM ('daily','weekly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.loan_penalty_type AS ENUM ('percentage','fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.installment_status AS ENUM ('due','paid','missed','partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- SAVINGS PLANS ----------
CREATE TABLE IF NOT EXISTS public.savings_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  installment_type public.savings_installment_type NOT NULL DEFAULT 'monthly',
  installment_amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  maturity_type public.savings_maturity_type NOT NULL DEFAULT 'simple',
  is_active boolean NOT NULL DEFAULT true,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_savings_plans_office ON public.savings_plans(office_id);
CREATE INDEX IF NOT EXISTS idx_savings_plans_active ON public.savings_plans(is_active);

ALTER TABLE public.savings_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read savings_plans" ON public.savings_plans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id IS NULL OR office_id = current_user_office());

CREATE POLICY "admin manage savings_plans" ON public.savings_plans
  FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

-- Link a farmer to a savings plan (additive — does NOT touch savings_transactions)
CREATE TABLE IF NOT EXISTS public.farmer_savings_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.savings_plans(id) ON DELETE RESTRICT,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_total numeric NOT NULL DEFAULT 0,
  expected_interest numeric NOT NULL DEFAULT 0,
  maturity_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fsp_farmer ON public.farmer_savings_plans(farmer_id);
CREATE INDEX IF NOT EXISTS idx_fsp_office ON public.farmer_savings_plans(office_id);

ALTER TABLE public.farmer_savings_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read fsp" ON public.farmer_savings_plans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "office insert fsp" ON public.farmer_savings_plans
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "admin update fsp" ON public.farmer_savings_plans
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "admin delete fsp" ON public.farmer_savings_plans
  FOR DELETE TO authenticated
  USING (is_admin_or_super(auth.uid()));

-- ---------- LOAN PLANS ----------
CREATE TABLE IF NOT EXISTS public.loan_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  installment_type public.loan_installment_type NOT NULL DEFAULT 'monthly',
  interest_rate numeric NOT NULL DEFAULT 0,
  penalty_type public.loan_penalty_type NOT NULL DEFAULT 'percentage',
  penalty_value numeric NOT NULL DEFAULT 0,
  grace_period_days integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  office_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_plans_office ON public.loan_plans(office_id);
CREATE INDEX IF NOT EXISTS idx_loan_plans_active ON public.loan_plans(is_active);

ALTER TABLE public.loan_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read loan_plans" ON public.loan_plans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id IS NULL OR office_id = current_user_office());

CREATE POLICY "admin manage loan_plans" ON public.loan_plans
  FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

-- Add additive nullable references to loans (no logic change)
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.loan_plans(id) ON DELETE SET NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS installment_amount numeric;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_due numeric;

-- ---------- LOAN INSTALLMENTS ----------
CREATE TABLE IF NOT EXISTS public.loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_no integer NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  penalty_amount numeric NOT NULL DEFAULT 0,
  status public.installment_status NOT NULL DEFAULT 'due',
  paid_on date,
  office_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_no)
);

CREATE INDEX IF NOT EXISTS idx_li_loan ON public.loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_li_due ON public.loan_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_li_status ON public.loan_installments(status);
CREATE INDEX IF NOT EXISTS idx_li_office ON public.loan_installments(office_id);

ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read installments" ON public.loan_installments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());

CREATE POLICY "office insert installments" ON public.loan_installments
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "committee update installments" ON public.loan_installments
  FOR UPDATE TO authenticated
  USING (is_committee_or_super(auth.uid()));

CREATE POLICY "committee delete installments" ON public.loan_installments
  FOR DELETE TO authenticated
  USING (is_committee_or_super(auth.uid()));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_savings_plans_touch ON public.savings_plans;
CREATE TRIGGER trg_savings_plans_touch BEFORE UPDATE ON public.savings_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_loan_plans_touch ON public.loan_plans;
CREATE TRIGGER trg_loan_plans_touch BEFORE UPDATE ON public.loan_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_fsp_touch ON public.farmer_savings_plans;
CREATE TRIGGER trg_fsp_touch BEFORE UPDATE ON public.farmer_savings_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_li_touch ON public.loan_installments;
CREATE TRIGGER trg_li_touch BEFORE UPDATE ON public.loan_installments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
