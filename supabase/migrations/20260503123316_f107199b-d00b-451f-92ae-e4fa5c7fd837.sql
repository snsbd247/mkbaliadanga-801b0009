ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS pdf_footer_text text DEFAULT 'If found, please return to the issuing office.',
  ADD COLUMN IF NOT EXISTS pdf_footer_show_address boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pdf_footer_show_contact boolean NOT NULL DEFAULT true;