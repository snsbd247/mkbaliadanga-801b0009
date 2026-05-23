ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS min_stock_level numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warranty_alert_days integer NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS public.asset_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  location_id uuid,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock','warranty_expiring','warranty_expired')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  message_en text NOT NULL,
  message_bn text,
  details jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  sms_sent_count integer NOT NULL DEFAULT 0,
  last_sms_at timestamptz,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_alerts_office_status ON public.asset_alerts(office_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_alerts_asset ON public.asset_alerts(asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_alerts_open
  ON public.asset_alerts(asset_id, alert_type, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

ALTER TABLE public.asset_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view asset_alerts in office" ON public.asset_alerts;
CREATE POLICY "view asset_alerts in office"
  ON public.asset_alerts FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

DROP POLICY IF EXISTS "admin update asset_alerts" ON public.asset_alerts;
CREATE POLICY "admin update asset_alerts"
  ON public.asset_alerts FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

DROP POLICY IF EXISTS "admin insert asset_alerts" ON public.asset_alerts;
CREATE POLICY "admin insert asset_alerts"
  ON public.asset_alerts FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

DROP POLICY IF EXISTS "admin delete asset_alerts" ON public.asset_alerts;
CREATE POLICY "admin delete asset_alerts"
  ON public.asset_alerts FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id = current_user_office() OR office_id IS NULL))
  );

CREATE OR REPLACE FUNCTION public.asset_alerts_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asset_alerts_updated_at ON public.asset_alerts;
CREATE TRIGGER trg_asset_alerts_updated_at
  BEFORE UPDATE ON public.asset_alerts
  FOR EACH ROW EXECUTE FUNCTION public.asset_alerts_touch_updated_at();