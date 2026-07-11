ALTER TABLE public.hand_cash_submissions ADD COLUMN IF NOT EXISTS stream text NOT NULL DEFAULT 'irrigation';
ALTER TABLE public.hand_cash_submissions DROP CONSTRAINT IF EXISTS hand_cash_submissions_office_id_year_month_key;
ALTER TABLE public.hand_cash_submissions ADD CONSTRAINT hand_cash_submissions_office_year_month_stream_key UNIQUE (office_id, year, month, stream);