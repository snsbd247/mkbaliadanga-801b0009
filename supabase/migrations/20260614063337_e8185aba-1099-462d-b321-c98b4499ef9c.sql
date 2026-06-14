ALTER TABLE public.irrigation_invoices ADD COLUMN IF NOT EXISTS previous_due_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.irrigation_invoices ADD COLUMN IF NOT EXISTS carried_forward_at timestamptz;
ALTER TABLE public.irrigation_invoices ADD COLUMN IF NOT EXISTS carried_forward_to uuid;