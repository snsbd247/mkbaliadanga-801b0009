CREATE INDEX IF NOT EXISTS idx_farmers_account_number_lower ON public.farmers (lower(account_number));
CREATE INDEX IF NOT EXISTS idx_farmers_mobile_lower ON public.farmers (lower(mobile));
CREATE INDEX IF NOT EXISTS idx_farmers_voter_number_lower ON public.farmers (lower(voter_number));
CREATE INDEX IF NOT EXISTS idx_farmers_name_en_lower ON public.farmers (lower(name_en));