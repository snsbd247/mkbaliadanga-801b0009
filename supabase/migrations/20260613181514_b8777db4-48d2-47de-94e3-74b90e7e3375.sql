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
  v_headers jsonb := '{}'::jsonb;
  v_host text;
  v_proto text;
BEGIN
  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled THEN RETURN NULL; END IF;
  IF _mobile IS NULL OR length(trim(_mobile)) < 6 THEN RETURN NULL; END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN RETURN NULL; END IF;

  IF _office IS NOT NULL THEN
    SELECT enabled INTO v_office_enabled FROM public.sms_office_settings WHERE office_id = _office;
    IF v_office_enabled IS NOT NULL AND v_office_enabled = false THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.sms_logs(mobile, message, status, event_type, farmer_id, reference_type, reference_id, office_id, created_by)
  VALUES (trim(_mobile), _message, 'queued', _event, _farmer, _ref_type, _ref_id, _office, auth.uid())
  RETURNING id INTO v_id;

  BEGIN
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;

  v_url := nullif(current_setting('app.supabase_url', true), '');
  v_anon := nullif(current_setting('app.supabase_anon_key', true), '');

  IF v_url IS NULL THEN
    v_host := coalesce(
      nullif(v_headers ->> 'x-forwarded-host', ''),
      nullif(v_headers ->> 'host', ''),
      nullif(v_headers ->> 'Host', '')
    );
    v_proto := coalesce(nullif(v_headers ->> 'x-forwarded-proto', ''), 'https');
    IF v_host IS NOT NULL THEN
      IF v_host ~* '^https?://' THEN
        v_url := regexp_replace(v_host, '/+$', '');
      ELSE
        v_url := v_proto || '://' || regexp_replace(v_host, '/+$', '');
      END IF;
    END IF;
  END IF;

  IF v_anon IS NULL THEN
    v_anon := coalesce(
      nullif(v_headers ->> 'apikey', ''),
      nullif(v_headers ->> 'x-api-key', '')
    );
  END IF;

  IF v_url IS NULL OR v_anon IS NULL THEN
    RETURN v_id;
  END IF;

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