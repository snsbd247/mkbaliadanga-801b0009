
CREATE TABLE IF NOT EXISTS public.sms_office_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  sender_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_office_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read sms_office_settings" ON public.sms_office_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "super admin manage sms_office_settings" ON public.sms_office_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER sms_office_settings_touch
  BEFORE UPDATE ON public.sms_office_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Update sms_enqueue to honour per-office override
CREATE OR REPLACE FUNCTION public.sms_enqueue(_mobile text, _message text, _event text, _farmer uuid, _ref_type text, _ref_id uuid, _office uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_settings public.sms_settings%ROWTYPE;
  v_office_enabled boolean;
  v_url text;
  v_anon text;
BEGIN
  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled THEN RETURN NULL; END IF;
  IF _mobile IS NULL OR length(trim(_mobile)) < 6 THEN RETURN NULL; END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN RETURN NULL; END IF;

  -- Per-office override
  IF _office IS NOT NULL THEN
    SELECT enabled INTO v_office_enabled FROM public.sms_office_settings WHERE office_id = _office;
    IF v_office_enabled IS NOT NULL AND v_office_enabled = false THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.sms_logs(mobile, message, status, event_type, farmer_id, reference_type, reference_id, office_id, created_by)
  VALUES (trim(_mobile), _message, 'queued', _event, _farmer, _ref_type, _ref_id, _office, auth.uid())
  RETURNING id INTO v_id;

  v_url := coalesce(current_setting('app.supabase_url', true), 'https://jcdonpeftfrnzblhtsqo.supabase.co');
  v_anon := coalesce(current_setting('app.supabase_anon_key', true),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZG9ucGVmdGZybnpibGh0c3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzI1MTcsImV4cCI6MjA5MzI0ODUxN30.VGQQ5DOROqKG4qat-Zriern5Kmweql62HxiaVB5vxHY');

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-sms',
      headers := jsonb_build_object('Content-Type','application/json','apikey',v_anon,'Authorization','Bearer '||v_anon),
      body := jsonb_build_object('log_id', v_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN v_id;
END $function$;
