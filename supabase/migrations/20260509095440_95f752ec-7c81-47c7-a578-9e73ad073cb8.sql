-- Add ledger integrity helper RPCs and payments→offices FK

-- 1) Foreign key for PostgREST embedding payments.offices(name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_office_id_fkey' AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_office_id_fkey
      FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Ledger integrity helper functions used by /ledger-integrity and ledger-check edge fn

CREATE OR REPLACE FUNCTION public.ledger_unbalanced_refs()
RETURNS TABLE (
  reference_type text,
  reference_id   uuid,
  total_debit    numeric,
  total_credit   numeric,
  diff           numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    le.reference_type,
    le.reference_id,
    COALESCE(SUM(le.debit), 0)  AS total_debit,
    COALESCE(SUM(le.credit), 0) AS total_credit,
    COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS diff
  FROM public.ledger_entries le
  WHERE le.reference_type IS NOT NULL AND le.reference_id IS NOT NULL
  GROUP BY le.reference_type, le.reference_id
  HAVING ABS(COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0)) > 0.001
  ORDER BY ABS(COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0)) DESC
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.ledger_orphan_refs()
RETURNS TABLE (
  reference_type text,
  reference_id   uuid,
  entry_count    bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  -- savings
  FOR rec IN
    SELECT le.reference_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'savings'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.savings_transactions s WHERE s.id = rec.reference_id) THEN
      reference_type := 'savings'; reference_id := rec.reference_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- loan
  FOR rec IN
    SELECT le.reference_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'loan'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.id = rec.reference_id) THEN
      reference_type := 'loan'; reference_id := rec.reference_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- loan_payment
  FOR rec IN
    SELECT le.reference_id, count(*) AS c
    FROM public.ledger_entries le
    WHERE le.reference_type = 'loan_payment'
    GROUP BY le.reference_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.loan_payments lp WHERE lp.id = rec.reference_id) THEN
      reference_type := 'loan_payment'; reference_id := rec.reference_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- expense / payment (payments table)
  FOR rec IN
    SELECT le.reference_id, count(*) AS c, le.reference_type AS rtype
    FROM public.ledger_entries le
    WHERE le.reference_type IN ('expense','payment')
    GROUP BY le.reference_id, le.reference_type
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = rec.reference_id) THEN
      reference_type := rec.rtype; reference_id := rec.reference_id; entry_count := rec.c;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_integrity_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_entries',        (SELECT count(*) FROM public.ledger_entries),
    'unbalanced_refs',      (SELECT count(*) FROM public.ledger_unbalanced_refs()),
    'orphan_refs',          (SELECT count(*) FROM public.ledger_orphan_refs()),
    'missing_account_rows', (SELECT count(*) FROM public.ledger_entries WHERE account_id IS NULL),
    'generated_at',         now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.ledger_unbalanced_refs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_orphan_refs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_integrity_summary() TO authenticated;