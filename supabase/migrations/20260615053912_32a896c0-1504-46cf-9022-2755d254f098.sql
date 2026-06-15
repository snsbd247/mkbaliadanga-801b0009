-- Audit table for blocked savings/loans attempts
CREATE TABLE public.member_block_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempted_by uuid,
  office_id uuid,
  farmer_id uuid,
  transaction_type text NOT NULL,
  reason text NOT NULL,
  member_no text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.member_block_audit TO authenticated;
GRANT ALL ON public.member_block_audit TO service_role;

ALTER TABLE public.member_block_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can log member blocks"
ON public.member_block_audit FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Office can view member block audit"
ON public.member_block_audit FOR SELECT TO authenticated
USING (
  office_id IS NULL
  OR office_id = (SELECT office_id FROM public.profiles WHERE id = auth.uid())
);

-- Enforcement trigger: savings/loans only for active members with a valid member number
CREATE OR REPLACE FUNCTION public.assert_member_eligible_for_savings_loan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f_status   text;
  f_memberno text;
  f_name     text;
BEGIN
  SELECT status, member_no, COALESCE(name_bn, name_en)
    INTO f_status, f_memberno, f_name
  FROM public.farmers
  WHERE id = NEW.farmer_id;

  IF f_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'MEMBER_INACTIVE: % একটিভ সদস্য নয় — সঞ্চয়/ঋণ ট্রানজেকশন করা যাবে না। | % is not an active member — savings/loan transactions are not allowed.',
      COALESCE(f_name, NEW.farmer_id::text), COALESCE(f_name, NEW.farmer_id::text)
      USING ERRCODE = 'check_violation';
  END IF;

  IF f_memberno IS NULL
     OR btrim(f_memberno) = ''
     OR btrim(f_memberno) !~ '^[0-9A-Za-z/-]{1,20}$'
     OR btrim(f_memberno) !~ '[0-9]' THEN
    RAISE EXCEPTION 'MEMBER_NO_INVALID: % এর সদস্য নাম্বার নেই বা সঠিক নয় — সঞ্চয়/ঋণ ট্রানজেকশন করা যাবে না। | % has a missing or invalid member number — savings/loan transactions are not allowed.',
      COALESCE(f_name, NEW.farmer_id::text), COALESCE(f_name, NEW.farmer_id::text)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_savings_tx_member_eligible
BEFORE INSERT ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.assert_member_eligible_for_savings_loan();

CREATE TRIGGER trg_loans_member_eligible
BEFORE INSERT ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.assert_member_eligible_for_savings_loan();