
ALTER TABLE public.card_settings
  ADD COLUMN IF NOT EXISTS header_height_mm numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS logo_size_mm numeric NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS custom_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_text_bn text NOT NULL DEFAULT '';

-- Ensure performance indexes exist for account / voter lookups
CREATE INDEX IF NOT EXISTS idx_farmers_account_number ON public.farmers (account_number);
CREATE INDEX IF NOT EXISTS idx_farmers_voter_number ON public.farmers (voter_number);
