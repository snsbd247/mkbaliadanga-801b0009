-- Add receipt_no to payments and savings_transactions, with auto-generate trigger and unique index per office.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_no text;
ALTER TABLE public.savings_transactions ADD COLUMN IF NOT EXISTS receipt_no text;

-- Add new ENUM value share_deposit (additive, idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'savings_txn_type' AND e.enumlabel = 'share_deposit'
  ) THEN
    ALTER TYPE public.savings_txn_type ADD VALUE 'share_deposit';
  END IF;
END $$;

-- Daily-sequential receipt-number generator (office-aware, fallback global)
CREATE OR REPLACE FUNCTION public.generate_receipt_no(_office_id uuid, _ts timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _date_part text := to_char(_ts, 'YYYYMMDD');
  _next int;
  _prefix text;
BEGIN
  -- Count existing receipts today scoped by office (or global if office null)
  SELECT COALESCE(MAX(seq), 0) + 1 INTO _next
  FROM (
    SELECT (regexp_match(receipt_no, 'RCPT-\d{8}-(\d+)$'))[1]::int AS seq
    FROM (
      SELECT receipt_no, office_id FROM public.payments
      WHERE receipt_no LIKE 'RCPT-' || _date_part || '-%'
      UNION ALL
      SELECT receipt_no, office_id FROM public.savings_transactions
      WHERE receipt_no LIKE 'RCPT-' || _date_part || '-%'
    ) all_r
    WHERE (_office_id IS NULL AND office_id IS NULL)
       OR (_office_id IS NOT NULL AND office_id = _office_id)
  ) parsed
  WHERE seq IS NOT NULL;

  RETURN 'RCPT-' || _date_part || '-' || lpad(_next::text, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_receipt_no(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_receipt_no(uuid, timestamptz) TO authenticated;

-- Trigger: auto-fill receipt_no on insert if blank
CREATE OR REPLACE FUNCTION public.fill_receipt_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_no IS NULL OR length(trim(NEW.receipt_no)) = 0 THEN
    NEW.receipt_no := public.generate_receipt_no(NEW.office_id, COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_receipt_no_payments ON public.payments;
CREATE TRIGGER trg_fill_receipt_no_payments
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.fill_receipt_no();

DROP TRIGGER IF EXISTS trg_fill_receipt_no_savings ON public.savings_transactions;
CREATE TRIGGER trg_fill_receipt_no_savings
BEFORE INSERT ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.fill_receipt_no();

-- Unique index per office (allow duplicates only across distinct offices)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt_no_office
  ON public.payments (office_id, receipt_no) WHERE receipt_no IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_savings_receipt_no_office
  ON public.savings_transactions (office_id, receipt_no) WHERE receipt_no IS NOT NULL;