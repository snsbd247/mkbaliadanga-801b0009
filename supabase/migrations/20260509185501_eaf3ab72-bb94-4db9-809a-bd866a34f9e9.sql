
CREATE TABLE IF NOT EXISTS public.background_retry_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid,
  job_type text NOT NULL,
  reference_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count int NOT NULL DEFAULT 0,
  max_retry int NOT NULL DEFAULT 4,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brj_status_next ON public.background_retry_jobs(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_brj_office ON public.background_retry_jobs(office_id);
CREATE INDEX IF NOT EXISTS idx_brj_ref ON public.background_retry_jobs(job_type, reference_id);

-- Status validation via trigger (no CHECK with non-immutable funcs)
CREATE OR REPLACE FUNCTION public.validate_brj_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','retrying','succeeded','failed','permanently_failed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.job_type NOT IN ('receipt_generation','sms_send','sms_delivery_check','report_export') THEN
    RAISE EXCEPTION 'Invalid job_type: %', NEW.job_type;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brj_validate ON public.background_retry_jobs;
CREATE TRIGGER trg_brj_validate
  BEFORE INSERT OR UPDATE ON public.background_retry_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_brj_status();

ALTER TABLE public.background_retry_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read brj" ON public.background_retry_jobs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "auth insert brj" ON public.background_retry_jobs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);

CREATE POLICY "super manage brj" ON public.background_retry_jobs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admin update brj" ON public.background_retry_jobs
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office()))
  WITH CHECK (is_admin_or_super(auth.uid()) AND (has_role(auth.uid(),'super_admin'::app_role) OR office_id = current_user_office()));
