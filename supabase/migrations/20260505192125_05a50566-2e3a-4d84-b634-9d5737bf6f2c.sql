ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS loan_receipt_header_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS loan_receipt_header_bn text DEFAULT '',
  ADD COLUMN IF NOT EXISTS loan_receipt_footer_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS loan_receipt_footer_bn text DEFAULT '',
  ADD COLUMN IF NOT EXISTS loan_receipt_no_format text DEFAULT 'LOAN-{YYYYMMDD}-{TAIL}';