ALTER TABLE public.loan_guarantors
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'guarantor';

ALTER TABLE public.loan_guarantors
  DROP CONSTRAINT IF EXISTS loan_guarantors_role_check;

ALTER TABLE public.loan_guarantors
  ADD CONSTRAINT loan_guarantors_role_check CHECK (role IN ('guarantor', 'nominee'));