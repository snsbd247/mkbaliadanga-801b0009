CREATE OR REPLACE FUNCTION public.farmer_savings_statement(
  _farmer_id uuid,
  _from date DEFAULT NULL,
  _to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entry_date date,
  description text,
  debit numeric,
  credit numeric,
  balance numeric,
  reference_type text,
  reference_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office uuid;
BEGIN
  SELECT f.office_id INTO v_office FROM public.farmers f WHERE f.id = _farmer_id;
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR v_office = current_user_office()) THEN
    RAISE EXCEPTION 'Access denied for farmer statement';
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT le.id, le.entry_date, le.description, le.debit, le.credit, le.reference_type, le.reference_id
    FROM public.ledger_entries le
    JOIN public.accounts a ON a.id = le.account_id AND a.code = '2010'
    JOIN public.savings_transactions s ON s.id = le.reference_id
    WHERE le.reference_type IN ('savings','savings_transaction')
      AND s.farmer_id = _farmer_id
      AND s.status = 'approved'
      AND (_from IS NULL OR le.entry_date >= _from)
      AND (_to IS NULL OR le.entry_date <= _to)
  )
  SELECT
    src.id, src.entry_date, src.description, src.debit, src.credit,
    SUM(src.credit - src.debit) OVER (ORDER BY src.entry_date, src.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
    src.reference_type, src.reference_id
  FROM src
  ORDER BY src.entry_date, src.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.farmer_loan_statement(
  _farmer_id uuid,
  _from date DEFAULT NULL,
  _to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entry_date date,
  description text,
  debit numeric,
  credit numeric,
  balance numeric,
  reference_type text,
  reference_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office uuid;
BEGIN
  SELECT f.office_id INTO v_office FROM public.farmers f WHERE f.id = _farmer_id;
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR v_office = current_user_office()) THEN
    RAISE EXCEPTION 'Access denied for farmer statement';
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT le.id, le.entry_date, le.description, le.debit, le.credit, le.reference_type, le.reference_id
    FROM public.ledger_entries le
    JOIN public.accounts a ON a.id = le.account_id AND a.code = '1040'
    JOIN public.loans ln ON ln.id = le.reference_id
    WHERE le.reference_type = 'loan'
      AND ln.farmer_id = _farmer_id
      AND ln.status IN ('approved','closed')
      AND (_from IS NULL OR le.entry_date >= _from)
      AND (_to IS NULL OR le.entry_date <= _to)
    UNION ALL
    SELECT le.id, le.entry_date, le.description, le.debit, le.credit, le.reference_type, le.reference_id
    FROM public.ledger_entries le
    JOIN public.accounts a ON a.id = le.account_id AND a.code = '1040'
    JOIN public.loan_payments lp ON lp.id = le.reference_id
    JOIN public.loans ln ON ln.id = lp.loan_id
    WHERE le.reference_type = 'loan_payment'
      AND ln.farmer_id = _farmer_id
      AND lp.status = 'approved'
      AND (_from IS NULL OR le.entry_date >= _from)
      AND (_to IS NULL OR le.entry_date <= _to)
  )
  SELECT
    src.id, src.entry_date, src.description, src.debit, src.credit,
    SUM(src.debit - src.credit) OVER (ORDER BY src.entry_date, src.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
    src.reference_type, src.reference_id
  FROM src
  ORDER BY src.entry_date, src.id;
END;
$$;