ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS verify_token text UNIQUE;
UPDATE public.payments SET verify_token = encode(gen_random_bytes(12),'hex') WHERE verify_token IS NULL;
ALTER TABLE public.payments ALTER COLUMN verify_token SET DEFAULT encode(gen_random_bytes(12),'hex');
ALTER TABLE public.payments ALTER COLUMN verify_token SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_verify_token ON public.payments(verify_token);