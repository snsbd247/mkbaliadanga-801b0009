CREATE OR REPLACE FUNCTION public.ledger_orphan_refs()
RETURNS TABLE(reference_type text, reference_id uuid, entry_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  -- savings
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'savings'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.id = rec.ref_id) THEN
      reference_type := 'savings'; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- loan
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'loan'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.id = rec.ref_id) THEN
      reference_type := 'loan'; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- loan_payment
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'loan_payment'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.loan_payments lp WHERE lp.id = rec.ref_id) THEN
      reference_type := 'loan_payment'; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- expense → expenses table
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'expense'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = rec.ref_id) THEN
      reference_type := 'expense'; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- payment → payments table
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'payment'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = rec.ref_id) THEN
      reference_type := 'payment'; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- irrigation → irrigation_invoices
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'irrigation'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.irrigation_invoices i WHERE i.id = rec.ref_id) THEN
      reference_type := 'irrigation'; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;