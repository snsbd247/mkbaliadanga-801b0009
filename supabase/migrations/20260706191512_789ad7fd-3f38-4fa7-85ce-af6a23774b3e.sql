
ALTER TABLE public.receipt_settings
  ADD COLUMN IF NOT EXISTS receipt_serial_start bigint NOT NULL DEFAULT 0;

-- Central sequential receipt number honoring the admin-configured start value.
CREATE OR REPLACE FUNCTION public.next_serial_receipt_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start bigint := 0;
  v_no bigint;
BEGIN
  SELECT COALESCE(receipt_serial_start, 0) INTO v_start
  FROM public.receipt_settings WHERE id = 1;

  INSERT INTO public.receipt_counters (kind, year, last_no, updated_at)
  VALUES ('SERIAL', 0, v_start + 1, now())
  ON CONFLICT (kind, year)
  DO UPDATE SET last_no = GREATEST(public.receipt_counters.last_no, v_start) + 1,
                updated_at = now()
  RETURNING last_no INTO v_no;

  RETURN v_no::text;
END;
$function$;

-- Route every existing generator through the single serial counter.
CREATE OR REPLACE FUNCTION public.generate_receipt_no(_office_id uuid, _ts timestamp with time zone DEFAULT now())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.next_serial_receipt_no();
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_unified_receipt_no(p_office_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.next_serial_receipt_no();
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_monthly_receipt_no(p_office_id uuid, p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.next_serial_receipt_no();
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_receipt_no(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.next_serial_receipt_no();
END;
$function$;
