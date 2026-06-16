-- 1. Void/cancel columns on receipts (payments table already has voided_at/voided_by/void_reason)
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

-- 2. Pool of freed (voided) receipt numbers, reused by the next entry (no gap in serial)
CREATE TABLE IF NOT EXISTS public.receipt_no_pool (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid,
  receipt_no text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_no_pool TO authenticated;
GRANT ALL ON public.receipt_no_pool TO service_role;
ALTER TABLE public.receipt_no_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office read receipt pool" ON public.receipt_no_pool
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "admin manage receipt pool" ON public.receipt_no_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. next_unified_receipt_no: consume a pooled (voided) number first, else increment
CREATE OR REPLACE FUNCTION public.next_unified_receipt_no(p_office_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  y int := extract(year from now())::int;
  m int := extract(month from now())::int;
  n int;
  pooled text;
BEGIN
  -- Reuse the oldest freed number for this office (current month only)
  SELECT receipt_no INTO pooled
  FROM public.receipt_no_pool
  WHERE (office_id = p_office_id OR (office_id IS NULL AND p_office_id IS NULL))
    AND receipt_no LIKE format('RCP-%s-%s-%%', y, lpad(m::text, 2, '0'))
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF pooled IS NOT NULL THEN
    DELETE FROM public.receipt_no_pool WHERE receipt_no = pooled;
    RETURN pooled;
  END IF;

  INSERT INTO public.receipt_sequences(office_id, kind, year, month, last_no)
  VALUES (p_office_id, 'RCP', y, m, 1)
  ON CONFLICT (office_id, kind, year, month)
  DO UPDATE SET last_no = receipt_sequences.last_no + 1
  RETURNING last_no INTO n;
  RETURN format('RCP-%s-%s-%s', y, lpad(m::text, 2, '0'), lpad(n::text, 4, '0'));
END;
$function$;

-- 4. Atomic admin-only void: mark payment + receipt voided and recycle the number
CREATE OR REPLACE FUNCTION public.void_receipt_and_recycle(
  p_receipt_no text,
  p_office_id uuid,
  p_reason text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized to void receipts';
  END IF;

  UPDATE public.payments
     SET voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   WHERE receipt_no = p_receipt_no AND voided_at IS NULL;

  UPDATE public.receipts
     SET voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   WHERE receipt_no = p_receipt_no AND voided_at IS NULL;

  -- Recycle the number for the next entry (no gap)
  INSERT INTO public.receipt_no_pool(office_id, receipt_no)
  VALUES (p_office_id, p_receipt_no)
  ON CONFLICT (receipt_no) DO NOTHING;
END;
$function$;