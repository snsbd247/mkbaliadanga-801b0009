ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS approval_note text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS approval_note text;