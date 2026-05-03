-- Add approval workflow columns to farmer_savings_plans
ALTER TABLE public.farmer_savings_plans
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- Switch default to 'pending' for new enrollments (existing rows unchanged)
ALTER TABLE public.farmer_savings_plans
  ALTER COLUMN status SET DEFAULT 'pending';

-- Allow committee/super to approve, reject, cancel via UPDATE (admin update fsp policy already exists for is_admin_or_super)
-- Add a permissive policy ensuring committee role can also approve
DROP POLICY IF EXISTS "committee approve fsp" ON public.farmer_savings_plans;
CREATE POLICY "committee approve fsp" ON public.farmer_savings_plans
  FOR UPDATE TO authenticated
  USING (is_committee_or_super(auth.uid()))
  WITH CHECK (is_committee_or_super(auth.uid()));