CREATE OR REPLACE FUNCTION public.ensure_irrigation_invoice_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.office_id IS NULL THEN
    SELECT f.office_id INTO NEW.office_id
    FROM public.farmers f
    WHERE f.id = NEW.farmer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_irrigation_invoice_office ON public.irrigation_invoices;

CREATE TRIGGER trg_ensure_irrigation_invoice_office
BEFORE INSERT OR UPDATE ON public.irrigation_invoices
FOR EACH ROW
EXECUTE FUNCTION public.ensure_irrigation_invoice_office();