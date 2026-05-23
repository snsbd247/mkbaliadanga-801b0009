-- 1. extend alert_type CHECK to include maintenance_due
ALTER TABLE public.asset_alerts DROP CONSTRAINT IF EXISTS asset_alerts_alert_type_check;
ALTER TABLE public.asset_alerts
  ADD CONSTRAINT asset_alerts_alert_type_check
  CHECK (alert_type IN ('low_stock','warranty_expiring','warranty_expired','maintenance_due'));

-- 2. schedules table
CREATE TABLE IF NOT EXISTS public.asset_maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  title text NOT NULL,
  frequency_days integer NOT NULL CHECK (frequency_days > 0),
  next_due_at date NOT NULL,
  vendor text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  last_generated_alert_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_maint_sched_due ON public.asset_maintenance_schedules(next_due_at) WHERE active;
CREATE INDEX IF NOT EXISTS idx_asset_maint_sched_asset ON public.asset_maintenance_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_sched_office ON public.asset_maintenance_schedules(office_id);

ALTER TABLE public.asset_maintenance_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view maint schedules" ON public.asset_maintenance_schedules;
CREATE POLICY "view maint schedules" ON public.asset_maintenance_schedules
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (office_id = current_user_office() OR office_id IS NULL)
  );

DROP POLICY IF EXISTS "admin manage maint schedules ins" ON public.asset_maintenance_schedules;
CREATE POLICY "admin manage maint schedules ins" ON public.asset_maintenance_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

DROP POLICY IF EXISTS "admin manage maint schedules upd" ON public.asset_maintenance_schedules;
CREATE POLICY "admin manage maint schedules upd" ON public.asset_maintenance_schedules
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

DROP POLICY IF EXISTS "admin manage maint schedules del" ON public.asset_maintenance_schedules;
CREATE POLICY "admin manage maint schedules del" ON public.asset_maintenance_schedules
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

DROP TRIGGER IF EXISTS trg_asset_maint_sched_updated_at ON public.asset_maintenance_schedules;
CREATE TRIGGER trg_asset_maint_sched_updated_at
  BEFORE UPDATE ON public.asset_maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.asset_alerts_touch_updated_at();