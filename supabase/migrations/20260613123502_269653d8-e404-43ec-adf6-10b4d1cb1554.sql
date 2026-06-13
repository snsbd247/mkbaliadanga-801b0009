ALTER TABLE public.loan_payments
  ADD COLUMN IF NOT EXISTS principal_amount numeric,
  ADD COLUMN IF NOT EXISTS interest_amount numeric;