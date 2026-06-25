ALTER TABLE public.irrigation_invoice_payments
  ADD CONSTRAINT irrigation_invoice_payments_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;