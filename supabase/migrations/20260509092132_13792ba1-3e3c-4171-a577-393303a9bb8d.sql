
CREATE TABLE IF NOT EXISTS public.irrigation_rate_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  irrigation_season_id uuid,
  land_type_id uuid,
  old_rate numeric,
  new_rate numeric,
  change_reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  action text NOT NULL DEFAULT 'update'
);

CREATE INDEX IF NOT EXISTS idx_irrigation_rate_audit_changed_at ON public.irrigation_rate_audit_logs (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_irrigation_rate_audit_office ON public.irrigation_rate_audit_logs (office_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_rate_audit_season ON public.irrigation_rate_audit_logs (irrigation_season_id);

ALTER TABLE public.irrigation_rate_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read rate audit"
  ON public.irrigation_rate_audit_logs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (is_admin_or_super(auth.uid()) AND (office_id IS NULL OR office_id = current_user_office()))
  );

-- Trigger fn: log every rate insert/update/delete
CREATE OR REPLACE FUNCTION public.log_irrigation_rate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.irrigation_rate_audit_logs
      (office_id, irrigation_season_id, land_type_id, old_rate, new_rate, changed_by, action)
    VALUES
      (NEW.office_id, NEW.irrigation_season_id, NEW.land_type_id, NULL, NEW.rate_per_shotok, auth.uid(), 'insert');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.rate_per_shotok IS DISTINCT FROM OLD.rate_per_shotok THEN
      INSERT INTO public.irrigation_rate_audit_logs
        (office_id, irrigation_season_id, land_type_id, old_rate, new_rate, changed_by, action)
      VALUES
        (NEW.office_id, NEW.irrigation_season_id, NEW.land_type_id, OLD.rate_per_shotok, NEW.rate_per_shotok, auth.uid(), 'update');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.irrigation_rate_audit_logs
      (office_id, irrigation_season_id, land_type_id, old_rate, new_rate, changed_by, action)
    VALUES
      (OLD.office_id, OLD.irrigation_season_id, OLD.land_type_id, OLD.rate_per_shotok, NULL, auth.uid(), 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_irrigation_rate_change ON public.irrigation_season_rates;
CREATE TRIGGER trg_log_irrigation_rate_change
AFTER INSERT OR UPDATE OR DELETE ON public.irrigation_season_rates
FOR EACH ROW EXECUTE FUNCTION public.log_irrigation_rate_change();
