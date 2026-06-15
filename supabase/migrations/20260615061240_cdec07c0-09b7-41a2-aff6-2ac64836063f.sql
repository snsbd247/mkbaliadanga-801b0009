CREATE TABLE public.loan_discount_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  payment_id uuid,
  receipt_no text,
  office_id uuid,
  changed_by uuid,
  interest_before numeric NOT NULL DEFAULT 0,
  interest_after numeric NOT NULL DEFAULT 0,
  discount_before numeric NOT NULL DEFAULT 0,
  discount_after numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.loan_discount_audit TO authenticated;
GRANT ALL ON public.loan_discount_audit TO service_role;

ALTER TABLE public.loan_discount_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view discount audit"
  ON public.loan_discount_audit FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert discount audit"
  ON public.loan_discount_audit FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid());

CREATE INDEX idx_loan_discount_audit_loan ON public.loan_discount_audit(loan_id);