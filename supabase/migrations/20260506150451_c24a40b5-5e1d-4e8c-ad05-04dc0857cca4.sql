-- Update generate_member_no to produce 7-digit zero-padded ids without prefix
CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_next bigint;
  v_candidate text;
  v_exists boolean;
BEGIN
  LOOP
    v_next := nextval('public.farmer_member_seq');
    v_candidate := lpad(v_next::text, 7, '0');
    SELECT EXISTS(SELECT 1 FROM public.farmers WHERE member_no = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_candidate;
END $function$;

-- Backfill existing member_no values that match the old "M-XXXX" pattern -> 7-digit zero-padded
UPDATE public.farmers
SET member_no = lpad(regexp_replace(member_no, '^M-?0*', ''), 7, '0')
WHERE member_no ~ '^M-?\d+$';

-- Advance the sequence so future values don't collide with backfilled numeric ids
SELECT setval(
  'public.farmer_member_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(member_no, '\D', '', 'g'), ''))::bigint, 0) FROM public.farmers WHERE member_no ~ '^\d+$'),
    (SELECT last_value FROM public.farmer_member_seq)
  )
);