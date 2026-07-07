ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS patwari_id uuid REFERENCES public.patwaris(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_patwari_id ON public.payments(patwari_id);