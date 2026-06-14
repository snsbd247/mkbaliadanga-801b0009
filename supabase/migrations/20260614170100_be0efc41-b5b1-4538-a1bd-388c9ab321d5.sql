ALTER TABLE public.receipt_settings
  ADD COLUMN IF NOT EXISTS show_watermark boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS watermark_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_penalty_row boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_charge_row boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_placement text NOT NULL DEFAULT 'right';