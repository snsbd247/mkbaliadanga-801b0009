-- Triggers fire in alphabetical order for the same event. The receipt-number
-- generator depends on office_id, which the office-setter trigger fills from
-- the farmer. Force the office trigger to run first by giving it a name that
-- precedes "trg_fill_receipt_no_savings".
ALTER TRIGGER trg_sav_office ON public.savings_transactions
  RENAME TO trg_00_sav_office;

-- Same fix for payments (defensive — its receipt-no trigger has the same dependency).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.payments'::regclass
      AND tgname = 'trg_pay_office'
  ) THEN
    EXECUTE 'ALTER TRIGGER trg_pay_office ON public.payments RENAME TO trg_00_pay_office';
  END IF;
END$$;