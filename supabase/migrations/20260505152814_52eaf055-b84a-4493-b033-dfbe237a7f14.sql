
-- Case-insensitive unique index for member_no
DROP INDEX IF EXISTS public.farmers_member_no_uidx;
CREATE UNIQUE INDEX farmers_member_no_ci_uidx
  ON public.farmers (lower(member_no))
  WHERE member_no IS NOT NULL AND member_no <> '' AND deleted_at IS NULL;

-- Withdraw approval tracking columns (idempotent)
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason text;
