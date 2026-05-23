ALTER TABLE public.asset_movements
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.asset_movements
  DROP CONSTRAINT IF EXISTS asset_movements_approval_status_check;
ALTER TABLE public.asset_movements
  ADD CONSTRAINT asset_movements_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

-- Backfill: existing rows are considered already approved & applied
UPDATE public.asset_movements
  SET approval_status = 'approved', applied = true, approved_at = COALESCE(approved_at, created_at)
  WHERE approval_status = 'pending' AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS idx_asset_movements_pending
  ON public.asset_movements(office_id, created_at DESC)
  WHERE approval_status = 'pending' AND deleted_at IS NULL;