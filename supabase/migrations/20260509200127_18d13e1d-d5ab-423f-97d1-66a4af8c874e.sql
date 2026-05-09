
-- Expand loan_status enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='completed' AND enumtypid='loan_status'::regtype) THEN
    ALTER TYPE loan_status ADD VALUE 'completed';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='overdue' AND enumtypid='loan_status'::regtype) THEN
    ALTER TYPE loan_status ADD VALUE 'overdue';
  END IF;
END $$;

-- loan_delay_fee_settings additions
ALTER TABLE public.loan_delay_fee_settings
  ADD COLUMN IF NOT EXISTS daily_penalty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_penalty numeric,
  ADD COLUMN IF NOT EXISTS enforcement_mode text NOT NULL DEFAULT 'block';

ALTER TABLE public.loan_delay_fee_settings
  DROP CONSTRAINT IF EXISTS loan_delay_fee_settings_mode_check;
ALTER TABLE public.loan_delay_fee_settings
  ADD CONSTRAINT loan_delay_fee_settings_mode_check
    CHECK (mode = ANY (ARRAY['flat','percent','daily','combined']));
ALTER TABLE public.loan_delay_fee_settings
  ADD CONSTRAINT loan_delay_fee_settings_enforcement_check
    CHECK (enforcement_mode = ANY (ARRAY['block','warn','allow']));

-- loan_installments additions
ALTER TABLE public.loan_installments
  ADD COLUMN IF NOT EXISTS overdue_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_rule_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS strict_validation_override boolean NOT NULL DEFAULT false;

-- loan_payments additions
ALTER TABLE public.loan_payments
  ADD COLUMN IF NOT EXISTS penalty_collected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_by uuid REFERENCES auth.users(id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_loan_payments_paid_on2 ON public.loan_payments(paid_on);
CREATE INDEX IF NOT EXISTS idx_loan_installments_due_status ON public.loan_installments(due_date, status);

-- Trigger: recompute loan status after payment insert/update
CREATE OR REPLACE FUNCTION public.recompute_loan_status_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_inst int;
  paid_inst int;
  overdue_inst int;
  new_status loan_status;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'paid' OR paid_amount >= amount),
         COUNT(*) FILTER (WHERE (status <> 'paid' AND paid_amount < amount) AND due_date < CURRENT_DATE)
    INTO total_inst, paid_inst, overdue_inst
    FROM public.loan_installments
   WHERE loan_id = NEW.loan_id;

  IF total_inst > 0 AND paid_inst = total_inst THEN
    new_status := 'completed';
  ELSIF overdue_inst > 0 THEN
    new_status := 'overdue';
  ELSE
    new_status := NULL;
  END IF;

  IF new_status IS NOT NULL THEN
    UPDATE public.loans SET status = new_status, updated_at = now()
     WHERE id = NEW.loan_id AND status <> new_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_loan_status ON public.loan_payments;
CREATE TRIGGER trg_recompute_loan_status
AFTER INSERT OR UPDATE ON public.loan_payments
FOR EACH ROW EXECUTE FUNCTION public.recompute_loan_status_after_payment();
