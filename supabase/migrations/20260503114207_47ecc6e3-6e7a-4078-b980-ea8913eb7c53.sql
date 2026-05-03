
CREATE OR REPLACE FUNCTION public.farmer_dues_summary()
RETURNS TABLE (
  farmer_id uuid,
  loan_due numeric,
  irr_due numeric,
  savings_bal numeric,
  net_due numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ld AS (
    SELECT l.farmer_id, COALESCE(SUM(GREATEST(COALESCE(l.total_payable,0) - COALESCE(paid.s,0), 0)),0) AS loan_due
    FROM public.loans l
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(amount),0) s FROM public.loan_payments lp WHERE lp.loan_id = l.id
    ) paid ON true
    WHERE l.status::text = 'approved' AND l.deleted_at IS NULL
    GROUP BY l.farmer_id
  ),
  ir AS (
    SELECT farmer_id, COALESCE(SUM(due_amount),0) AS irr_due
    FROM public.irrigation_charges
    WHERE deleted_at IS NULL
    GROUP BY farmer_id
  ),
  sv AS (
    SELECT farmer_id,
           COALESCE(SUM(CASE WHEN type='deposit' AND status='approved' THEN amount
                             WHEN type='withdraw' AND status='approved' THEN -amount
                             ELSE 0 END),0) AS savings_bal
    FROM public.savings_transactions
    WHERE deleted_at IS NULL
    GROUP BY farmer_id
  )
  SELECT f.id AS farmer_id,
         COALESCE(ld.loan_due,0)   AS loan_due,
         COALESCE(ir.irr_due,0)    AS irr_due,
         COALESCE(sv.savings_bal,0) AS savings_bal,
         GREATEST(COALESCE(ld.loan_due,0) + COALESCE(ir.irr_due,0) - COALESCE(sv.savings_bal,0), 0) AS net_due
  FROM public.farmers f
  LEFT JOIN ld ON ld.farmer_id = f.id
  LEFT JOIN ir ON ir.farmer_id = f.id
  LEFT JOIN sv ON sv.farmer_id = f.id
  WHERE f.deleted_at IS NULL;
$$;
