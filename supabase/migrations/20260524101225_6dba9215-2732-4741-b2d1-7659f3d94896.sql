ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_payments_category ON public.payments(category);