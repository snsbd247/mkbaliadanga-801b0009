ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS loan_no text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_office_loan_no_unique
  ON public.loans (office_id, lower(loan_no))
  WHERE loan_no IS NOT NULL AND deleted_at IS NULL;