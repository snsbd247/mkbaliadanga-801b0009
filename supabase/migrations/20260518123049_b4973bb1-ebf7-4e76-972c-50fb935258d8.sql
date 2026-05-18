-- Update generate_member_no to produce 5-digit numbers instead of 7-digit
CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next bigint;
  v_candidate text;
  v_exists boolean;
BEGIN
  LOOP
    v_next := nextval('public.farmer_member_seq');
    v_candidate := lpad(v_next::text, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.farmers WHERE member_no = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_candidate;
END $function$;

-- Update generate_account_number to produce 5-digit numbers instead of 12-digit
CREATE OR REPLACE FUNCTION public.generate_account_number(_office_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _next bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(account_number, '')::bigint), 0) + 1
    INTO _next
    FROM public.farmers
   WHERE account_number ~ '^[0-9]{1,5}$';
  RETURN lpad(_next::text, 5, '0');
END $function$;

-- Also update farmer_code trigger to enforce max 5 digits strictly
CREATE OR REPLACE FUNCTION public.set_farmer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_num int;
BEGIN
  IF NEW.farmer_code IS NULL OR NEW.farmer_code = '' THEN
    next_num := nextval('public.farmer_code_seq');
    -- Wrap around to stay within 5 digits (max 99999)
    next_num := (next_num - 1) % 99999 + 1;
    NEW.farmer_code := lpad(next_num::text, 5, '0');
  ELSE
    -- Normalize any manually supplied value: strip alpha prefix like "F-" and pad to 5
    IF NEW.farmer_code !~ '^[0-9]+$' THEN
      NEW.farmer_code := lpad(regexp_replace(NEW.farmer_code, '^[A-Za-z]+-?', ''), 5, '0');
    END IF;
    -- Ensure exactly 5 digits max
    IF length(NEW.farmer_code) > 5 THEN
      NEW.farmer_code := substring(NEW.farmer_code from length(NEW.farmer_code) - 4 for 5);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;