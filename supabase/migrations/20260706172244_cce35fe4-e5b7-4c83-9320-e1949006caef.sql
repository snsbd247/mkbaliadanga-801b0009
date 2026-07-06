-- Ensure every irrigation invoice always has a status (VPS legacy safety).
UPDATE public.irrigation_invoices
SET invoice_status = 'generated'::invoice_status
WHERE invoice_status IS NULL;

ALTER TABLE public.irrigation_invoices
  ALTER COLUMN invoice_status SET DEFAULT 'generated'::invoice_status;

ALTER TABLE public.irrigation_invoices
  ALTER COLUMN invoice_status SET NOT NULL;