-- Enforce valid NID format (allow null/blank)
ALTER TABLE public.loan_guarantors
  DROP CONSTRAINT IF EXISTS loan_guarantors_nid_valid;
ALTER TABLE public.loan_guarantors
  ADD CONSTRAINT loan_guarantors_nid_valid
  CHECK (nid IS NULL OR nid ~ '^(\d{10}|\d{13}|\d{17})$');

-- Prevent duplicate guarantor/nominee per loan (role + name + nid)
CREATE UNIQUE INDEX IF NOT EXISTS loan_guarantors_unique_per_loan
  ON public.loan_guarantors (loan_id, role, lower(btrim(name)), coalesce(nid, ''));