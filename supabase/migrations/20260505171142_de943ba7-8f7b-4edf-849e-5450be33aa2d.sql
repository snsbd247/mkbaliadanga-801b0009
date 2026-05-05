
-- 1) Unified farmer dues breakdown ----------------------------------------------
CREATE OR REPLACE FUNCTION public.farmer_dues_breakdown(_farmer_id uuid)
RETURNS TABLE (
  farmer_id uuid,
  savings_balance numeric,
  share_balance numeric,
  loan_due numeric,
  irrigation_due numeric,
  net_due numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH sv AS (
    SELECT
      COALESCE(SUM(CASE WHEN type='deposit'  AND status='approved' THEN amount
                        WHEN type='withdraw' AND status='approved' THEN -amount
                        ELSE 0 END), 0) AS savings_balance,
      COALESCE(SUM(CASE WHEN type='share_collection' AND status='approved' THEN amount
                        ELSE 0 END), 0) AS share_balance
    FROM public.savings_transactions
    WHERE farmer_id = _farmer_id AND deleted_at IS NULL
  ),
  ld AS (
    SELECT COALESCE(SUM(GREATEST(COALESCE(l.total_payable,0) - COALESCE(p.s,0), 0)), 0) AS loan_due
    FROM public.loans l
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(amount),0) s FROM public.loan_payments lp WHERE lp.loan_id = l.id
    ) p ON true
    WHERE l.farmer_id = _farmer_id
      AND l.status::text = 'approved'
      AND l.deleted_at IS NULL
  ),
  ir AS (
    SELECT COALESCE(SUM(due_amount),0) AS irrigation_due
    FROM public.irrigation_charges
    WHERE farmer_id = _farmer_id AND deleted_at IS NULL
  )
  SELECT _farmer_id,
         sv.savings_balance,
         sv.share_balance,
         ld.loan_due,
         ir.irrigation_due,
         GREATEST(ld.loan_due + ir.irrigation_due - sv.savings_balance, 0) AS net_due
  FROM sv, ld, ir;
$$;

REVOKE EXECUTE ON FUNCTION public.farmer_dues_breakdown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.farmer_dues_breakdown(uuid) TO authenticated;

-- 2) Tighten edit/delete to super admin only ------------------------------------
-- Irrigation
DROP POLICY IF EXISTS "committee update irrigation" ON public.irrigation_charges;
DROP POLICY IF EXISTS "committee delete irrigation" ON public.irrigation_charges;
CREATE POLICY "super update irrigation" ON public.irrigation_charges
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super delete irrigation" ON public.irrigation_charges
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Loans
DROP POLICY IF EXISTS "committee update loans" ON public.loans;
DROP POLICY IF EXISTS "committee delete loans" ON public.loans;
CREATE POLICY "super update loans" ON public.loans
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super delete loans" ON public.loans
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Loan payments
DROP POLICY IF EXISTS "committee update loan payments" ON public.loan_payments;
DROP POLICY IF EXISTS "committee delete loan payments" ON public.loan_payments;
CREATE POLICY "super update loan payments" ON public.loan_payments
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "super delete loan payments" ON public.loan_payments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Savings transactions: keep committee approve/reject (status changes only) via existing committee policies if any;
-- but full edit/delete restricted to super.
-- Find and drop any committee-level update/delete on savings_transactions
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.savings_transactions'::regclass
      AND polname ILIKE 'committee%'
      AND polcmd IN ('w','d')  -- update / delete
  LOOP
    EXECUTE format('DROP POLICY %I ON public.savings_transactions', pol.polname);
  END LOOP;
END $$;

-- Allow committee to approve/reject by updating ONLY status-related fields is hard via RLS column-level,
-- so we keep approval through the existing approval RPC path. Edit/Delete here is super-only.
CREATE POLICY "super update savings_transactions"
  ON public.savings_transactions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "super delete savings_transactions"
  ON public.savings_transactions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
