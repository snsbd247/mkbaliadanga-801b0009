-- Fix 1: Resolve "column reference reference_type is ambiguous" in ledger RPCs
-- The OUT column names in RETURNS TABLE(...) conflict with le.reference_type
-- inside the same function body. Rewriting using subqueries / renamed OUT params.

CREATE OR REPLACE FUNCTION public.ledger_unbalanced_refs()
RETURNS TABLE(reference_type text, reference_id uuid, total_debit numeric, total_credit numeric, diff numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    sub.ref_type      AS reference_type,
    sub.ref_id        AS reference_id,
    sub.total_debit,
    sub.total_credit,
    sub.diff
  FROM (
    SELECT
      le.reference_type AS ref_type,
      le.reference_id   AS ref_id,
      COALESCE(SUM(le.debit), 0)  AS total_debit,
      COALESCE(SUM(le.credit), 0) AS total_credit,
      COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS diff
    FROM public.ledger_entries le
    WHERE le.reference_type IS NOT NULL AND le.reference_id IS NOT NULL
    GROUP BY le.reference_type, le.reference_id
    HAVING ABS(COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0)) > 0.001
    ORDER BY ABS(COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0)) DESC
    LIMIT 500
  ) sub;
$function$;

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

  -- expense / payment (payments table)
  FOR rec IN
    SELECT le.reference_id AS ref_id, count(*) AS c, le.reference_type AS rtype
    FROM public.ledger_entries le
    WHERE le.reference_type IN ('expense','payment')
    GROUP BY le.reference_id, le.reference_type
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = rec.ref_id) THEN
      reference_type := rec.rtype; reference_id := rec.ref_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;

-- Fix 2: Reload PostgREST schema cache so the relationship hints
-- (farmer_savings_plans -> farmers, irrigation_rates -> seasons, payments -> offices)
-- are picked up. The FKs already exist; cache was stale.
NOTIFY pgrst, 'reload schema';