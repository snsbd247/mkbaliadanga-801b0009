-- Generator for Farmer ID (member_no) — independent of account/voter number
CREATE SEQUENCE IF NOT EXISTS public.farmer_member_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
  v_candidate text;
  v_exists boolean;
BEGIN
  LOOP
    v_next := nextval('public.farmer_member_seq');
    v_candidate := 'MK-' || lpad(v_next::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.farmers WHERE member_no = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_candidate;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_member_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_member_no() TO authenticated;
