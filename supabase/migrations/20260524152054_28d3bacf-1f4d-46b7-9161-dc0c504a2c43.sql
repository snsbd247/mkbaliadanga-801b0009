CREATE OR REPLACE FUNCTION public.normalize_farmer_identifier(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _value IS NULL OR length(regexp_replace(_value, '\\D', '', 'g')) = 0 THEN NULL
    WHEN length(regexp_replace(_value, '\\D', '', 'g')) >= 5 THEN right(regexp_replace(_value, '\\D', '', 'g'), 5)
    ELSE lpad(regexp_replace(_value, '\\D', '', 'g'), 5, '0')
  END;
$function$;

CREATE OR REPLACE FUNCTION public.farmer_identifier_exists(_candidate text, _exclude_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.farmers
    WHERE (_exclude_id IS NULL OR id <> _exclude_id)
      AND (
        farmer_code = _candidate
        OR member_no = _candidate
        OR account_number = _candidate
        OR voter_number = _candidate
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.generate_farmer_account_number(p_office_id uuid, p_created_at timestamp with time zone)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
  i int := 1;
BEGIN
  WHILE i <= 99999 LOOP
    candidate := lpad(i::text, 5, '0');
    IF NOT public.farmer_identifier_exists(candidate, NULL) THEN
      RETURN candidate;
    END IF;
    i := i + 1;
  END LOOP;
  RAISE EXCEPTION 'No available 5-digit farmer identifiers remain';
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_farmer_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
BEGIN
  -- Manual Farmer ID/member_no is accepted, normalized, and becomes the source ID.
  IF TG_OP = 'UPDATE'
     AND NEW.member_no IS DISTINCT FROM OLD.member_no
     AND NEW.member_no IS NOT NULL
     AND length(trim(NEW.member_no)) > 0 THEN
    candidate := public.normalize_farmer_identifier(NEW.member_no);
  ELSIF NEW.farmer_code IS NOT NULL AND length(trim(NEW.farmer_code)) > 0 THEN
    candidate := public.normalize_farmer_identifier(NEW.farmer_code);
  ELSIF NEW.member_no IS NOT NULL AND length(trim(NEW.member_no)) > 0 THEN
    candidate := public.normalize_farmer_identifier(NEW.member_no);
  ELSE
    candidate := public.generate_farmer_account_number(NEW.office_id, COALESCE(NEW.created_at, now()));
  END IF;

  IF candidate IS NULL OR candidate !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Farmer ID must be exactly 5 digits';
  END IF;

  NEW.farmer_code := candidate;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_member_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.member_no := NEW.farmer_code;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.farmers_set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.farmer_code IS NULL OR length(trim(NEW.farmer_code)) = 0 THEN
    NEW.farmer_code := public.generate_farmer_account_number(NEW.office_id, COALESCE(NEW.created_at, now()));
  END IF;

  NEW.account_number := NEW.farmer_code;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.farmers_sync_voter_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.is_voter, false) THEN
    NEW.voter_number := NEW.account_number;
  ELSE
    NEW.voter_number := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.farmers_validate_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.farmer_code IS NULL OR NEW.farmer_code !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'farmer_code must be 5 digits (got %)', NEW.farmer_code
      USING ERRCODE = '22023';
  END IF;

  IF NEW.member_no IS NOT NULL AND NEW.member_no <> '' AND NEW.member_no !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'member_no must be 5 digits (got %)', NEW.member_no
      USING ERRCODE = '22023';
  END IF;

  IF NEW.account_number IS NOT NULL AND NEW.account_number <> '' AND NEW.account_number !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'account_number must be 5 digits (got %)', NEW.account_number
      USING ERRCODE = '22023';
  END IF;

  IF NEW.voter_number IS NOT NULL AND NEW.voter_number <> '' AND NEW.voter_number !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'voter_number must be 5 digits (got %)', NEW.voter_number
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.generate_farmer_account_number(NULL, now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_account_number(_office_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.generate_farmer_account_number(_office_id, now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.member_no_exists(_member_no text, _exclude_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.farmer_identifier_exists(public.normalize_farmer_identifier(_member_no), _exclude_id);
$function$;

DROP TRIGGER IF EXISTS trg_a_set_farmer_code ON public.farmers;
CREATE TRIGGER trg_a_set_farmer_code
BEFORE INSERT OR UPDATE OF farmer_code, member_no ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.set_farmer_code();

DROP TRIGGER IF EXISTS trg_b_farmers_set_account_number ON public.farmers;
CREATE TRIGGER trg_b_farmers_set_account_number
BEFORE INSERT OR UPDATE OF farmer_code, account_number, member_no ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.farmers_set_account_number();

DROP TRIGGER IF EXISTS trg_c_farmers_sync_voter_number ON public.farmers;
CREATE TRIGGER trg_c_farmers_sync_voter_number
BEFORE INSERT OR UPDATE OF voter_number, account_number, is_voter, farmer_code, member_no ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.farmers_sync_voter_number();

DROP TRIGGER IF EXISTS trg_set_member_no ON public.farmers;
CREATE TRIGGER trg_set_member_no
BEFORE INSERT OR UPDATE OF farmer_code, member_no ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.set_member_no();

REVOKE EXECUTE ON FUNCTION public.normalize_farmer_identifier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_farmer_identifier(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.farmer_identifier_exists(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.farmer_identifier_exists(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_farmer_account_number(uuid, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_farmer_account_number(uuid, timestamp with time zone) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_member_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_member_no() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_account_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_account_number(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.member_no_exists(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_no_exists(text, uuid) TO authenticated;