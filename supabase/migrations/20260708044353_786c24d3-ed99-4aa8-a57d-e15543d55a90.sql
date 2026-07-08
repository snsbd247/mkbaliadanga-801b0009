-- Clean up orphan link rows whose payment was previously nulled/deleted so the
-- restored CASCADE stays consistent (these were the "stuck as paid" rows).
DELETE FROM public.irrigation_invoice_payments WHERE payment_id IS NULL;

-- Change the link FK from ON DELETE SET NULL to ON DELETE CASCADE so deleting a
-- payment removes its link rows; each removed row fires the existing
-- trg_recalc_invoice_from_payments trigger, restoring the invoice's
-- paid_amount → due_amount → invoice_status.
ALTER TABLE public.irrigation_invoice_payments
  DROP CONSTRAINT irrigation_invoice_payments_payment_id_fkey;

ALTER TABLE public.irrigation_invoice_payments
  ADD CONSTRAINT irrigation_invoice_payments_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;

-- Atomic RPC to delete a payment receipt with full downstream sync.
CREATE OR REPLACE FUNCTION public.delete_payment_cascade(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_committee_or_super(auth.uid())
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied: committee or super_admin required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id = _payment_id) THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Remove irrigation links first so the AFTER DELETE recalc trigger restores
  -- each affected invoice's due_amount and invoice_status.
  DELETE FROM public.irrigation_invoice_payments WHERE payment_id = _payment_id;
  DELETE FROM public.payment_allocations WHERE payment_id = _payment_id;
  DELETE FROM public.payments WHERE id = _payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_payment_cascade(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';