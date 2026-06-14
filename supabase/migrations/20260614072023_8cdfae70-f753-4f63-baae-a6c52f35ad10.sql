CREATE OR REPLACE FUNCTION public.farmer_dues_breakdown(_farmer_id uuid)
 RETURNS TABLE(farmer_id uuid, savings_balance numeric, share_balance numeric, loan_due numeric, irrigation_due numeric, net_due numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH sv AS (
    SELECT
      COALESCE(SUM(CASE WHEN type='deposit'  AND status='approved' THEN amount
                        WHEN type='withdraw' AND status='approved' THEN -amount
                        ELSE 0 END), 0) AS savings_balance,
      COALESCE(SUM(CASE WHEN type='share_collection' AND status='approved' THEN amount
                        ELSE 0 END), 0) AS share_balance
    FROM public.savings_transactions
    WHERE farmer_id = _farmer_id AND deleted_at IS NULL
  ),
  ld AS (
    -- Loan due is based on PRINCIPAL only. Interest is optional/suggested and
    -- must never be shown as an outstanding due (client requirement).
    SELECT COALESCE(SUM(GREATEST(COALESCE(l.principal,0) - COALESCE(p.principal_paid,0), 0)), 0) AS loan_due
    FROM public.loans l
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(
               CASE WHEN lp.principal_amount IS NOT NULL AND lp.principal_amount > 0
                    THEN lp.principal_amount
                    ELSE lp.amount END
             ), 0) AS principal_paid
      FROM public.loan_payments lp WHERE lp.loan_id = l.id
    ) p ON true
    WHERE l.farmer_id = _farmer_id
      AND l.status::text = 'approved'
      AND l.deleted_at IS NULL
  ),
  ir AS (
    SELECT COALESCE(SUM(due_amount),0) AS irrigation_due
    FROM public.irrigation_charges
    WHERE farmer_id = _farmer_id AND deleted_at IS NULL
  )
  SELECT _farmer_id,
         sv.savings_balance,
         sv.share_balance,
         ld.loan_due,
         ir.irrigation_due,
         GREATEST(ld.loan_due + ir.irrigation_due - sv.savings_balance, 0) AS net_due
  FROM sv, ld, ir;
$function$;