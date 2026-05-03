-- Bank-style statement RPCs derived from ledger_entries only.
-- They DO NOT modify ledger structure, only read.

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
  SELECT office_id INTO v_office FROM farmers WHERE id = _farmer_id;
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR v_office = current_user_office()) THEN
    RAISE EXCEPTION 'Access denied for farmer statement';
  END IF;

  RETURN QUERY
  WITH src AS (
    -- Savings: liability account 2010 (Member Savings Payable). Credit = deposit, Debit = withdraw.
    SELECT le.id, le.entry_date, le.description, le.debit, le.credit, le.reference_type, le.reference_id
    FROM ledger_entries le
    JOIN accounts a ON a.id = le.account_id AND a.code = '2010'
    JOIN savings_transactions s ON s.id = le.reference_id
    WHERE le.reference_type IN ('savings','savings_transaction')
      AND s.farmer_id = _farmer_id
      AND s.status = 'approved'
      AND (_from IS NULL OR le.entry_date >= _from)
      AND (_to IS NULL OR le.entry_date <= _to)
  )
  SELECT
    s.id, s.entry_date, s.description, s.debit, s.credit,
    SUM(s.credit - s.debit) OVER (ORDER BY s.entry_date, s.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance,
    s.reference_type, s.reference_id
  FROM src s
  ORDER BY s.entry_date, s.id;
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
  SELECT office_id INTO v_office FROM farmers WHERE id = _farmer_id;
  IF NOT (has_role(auth.uid(), 'super_admin'::app_role) OR v_office = current_user_office()) THEN
    RAISE EXCEPTION 'Access denied for farmer statement';
  END IF;

  RETURN QUERY
  WITH src AS (
    -- Loan disbursements: Loan Receivable (1040) debit = loan owed
    SELECT le.id, le.entry_date, le.description, le.debit, le.credit, le.reference_type, le.reference_id
    FROM ledger_entries le
    JOIN accounts a ON a.id = le.account_id AND a.code = '1040'
    JOIN loans ln ON ln.id = le.reference_id
    WHERE le.reference_type = 'loan'
      AND ln.farmer_id = _farmer_id
      AND ln.status IN ('approved','closed')
      AND (_from IS NULL OR le.entry_date >= _from)
      AND (_to IS NULL OR le.entry_date <= _to)
    UNION ALL
    -- Loan payments: same account, credit = repayment
    SELECT le.id, le.entry_date, le.description, le.debit, le.credit, le.reference_type, le.reference_id
    FROM ledger_entries le
    JOIN accounts a ON a.id = le.account_id AND a.code = '1040'
    JOIN loan_payments lp ON lp.id = le.reference_id
    JOIN loans ln ON ln.id = lp.loan_id
    WHERE le.reference_type = 'loan_payment'
      AND ln.farmer_id = _farmer_id
      AND lp.status = 'approved'
      AND (_from IS NULL OR le.entry_date >= _from)
      AND (_to IS NULL OR le.entry_date <= _to)
  )
  SELECT
    s.id, s.entry_date, s.description, s.debit, s.credit,
    SUM(s.debit - s.credit) OVER (ORDER BY s.entry_date, s.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance,
    s.reference_type, s.reference_id
  FROM src s
  ORDER BY s.entry_date, s.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.farmer_savings_statement(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_loan_statement(uuid, date, date) TO authenticated;