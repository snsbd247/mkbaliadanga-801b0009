-- Round all existing irrigation invoice money fields to whole taka so paying a
-- rounded amount never leaves a fractional due behind.
UPDATE public.irrigation_invoices
SET
  irrigation_amount   = ROUND(COALESCE(irrigation_amount, 0)),
  maintenance_amount  = ROUND(COALESCE(maintenance_amount, 0)),
  canal_amount        = ROUND(COALESCE(canal_amount, 0)),
  delay_fee           = ROUND(COALESCE(delay_fee, 0)),
  other_charge        = ROUND(COALESCE(other_charge, 0)),
  discount_amount     = ROUND(COALESCE(discount_amount, 0)),
  previous_due_amount = ROUND(COALESCE(previous_due_amount, 0)),
  payable_amount      = ROUND(COALESCE(payable_amount, 0)),
  paid_amount         = ROUND(COALESCE(paid_amount, 0)),
  due_amount          = GREATEST(ROUND(COALESCE(payable_amount, 0)) - ROUND(COALESCE(paid_amount, 0)), 0)
WHERE deleted_at IS NULL
  AND (
    payable_amount <> ROUND(payable_amount)
    OR due_amount  <> ROUND(due_amount)
    OR paid_amount <> ROUND(paid_amount)
  );