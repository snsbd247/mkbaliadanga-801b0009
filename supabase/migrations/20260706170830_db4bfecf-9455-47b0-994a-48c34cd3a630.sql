CREATE OR REPLACE FUNCTION public.farmer_dues_summary_for(_farmer_ids uuid[])
 RETURNS TABLE(farmer_id uuid, loan_due numeric, irr_due numeric, savings_bal numeric, net_due numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH requested AS (
    SELECT DISTINCT unnest(COALESCE(_farmer_ids, ARRAY[]::uuid[])) AS farmer_id
  ),
  visible_farmers AS (
    SELECT f.id
    FROM public.farmers f
    INNER JOIN requested r ON r.farmer_id = f.id
    WHERE f.deleted_at IS NULL
  ),
  ld AS (
    SELECT l.farmer_id,
           COALESCE(SUM(GREATEST(COALESCE(l.principal, l.total_payable, 0) - COALESCE(p.principal_paid, 0), 0)), 0) AS loan_due
    FROM public.loans l
    INNER JOIN visible_farmers vf ON vf.id = l.farmer_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(
        CASE
          WHEN lp.principal_amount IS NOT NULL AND lp.principal_amount > 0 THEN lp.principal_amount
          ELSE lp.amount
        END
      ), 0) AS principal_paid
      FROM public.loan_payments lp
      WHERE lp.loan_id = l.id
    ) p ON true
    WHERE l.status::text = 'approved'
      AND l.deleted_at IS NULL
    GROUP BY l.farmer_id
  ),
  ir AS (
    SELECT i.farmer_id,
           COALESCE(SUM(GREATEST(COALESCE(i.due_amount, 0), 0)), 0) AS irr_due
    FROM public.irrigation_invoices i
    INNER JOIN visible_farmers vf ON vf.id = i.farmer_id
    WHERE i.deleted_at IS NULL
      AND COALESCE(i.invoice_status::text, '') <> 'cancelled'
    GROUP BY i.farmer_id
  ),
  sv AS (
    SELECT s.farmer_id,
           COALESCE(SUM(CASE
             WHEN s.type='deposit' AND s.status='approved' THEN s.amount
             WHEN s.type='withdraw' AND s.status='approved' THEN -s.amount
             ELSE 0
           END), 0) AS savings_bal
    FROM public.savings_transactions s
    INNER JOIN visible_farmers vf ON vf.id = s.farmer_id
    WHERE s.deleted_at IS NULL
    GROUP BY s.farmer_id
  )
  SELECT vf.id AS farmer_id,
         COALESCE(ld.loan_due, 0) AS loan_due,
         COALESCE(ir.irr_due, 0) AS irr_due,
         COALESCE(sv.savings_bal, 0) AS savings_bal,
         COALESCE(ld.loan_due, 0) + COALESCE(ir.irr_due, 0) AS net_due
  FROM visible_farmers vf
  LEFT JOIN ld ON ld.farmer_id = vf.id
  LEFT JOIN ir ON ir.farmer_id = vf.id
  LEFT JOIN sv ON sv.farmer_id = vf.id;
$function$;

REVOKE ALL ON FUNCTION public.farmer_dues_summary_for(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.farmer_dues_summary_for(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_dues_summary_for(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.farmer_dues_summary()
 RETURNS TABLE(farmer_id uuid, loan_due numeric, irr_due numeric, savings_bal numeric, net_due numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH visible_farmers AS (
    SELECT f.id
    FROM public.farmers f
    WHERE f.deleted_at IS NULL
  ),
  ld AS (
    SELECT l.farmer_id,
           COALESCE(SUM(GREATEST(COALESCE(l.principal, l.total_payable, 0) - COALESCE(p.principal_paid, 0), 0)), 0) AS loan_due
    FROM public.loans l
    INNER JOIN visible_farmers vf ON vf.id = l.farmer_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(
        CASE
          WHEN lp.principal_amount IS NOT NULL AND lp.principal_amount > 0 THEN lp.principal_amount
          ELSE lp.amount
        END
      ), 0) AS principal_paid
      FROM public.loan_payments lp
      WHERE lp.loan_id = l.id
    ) p ON true
    WHERE l.status::text = 'approved'
      AND l.deleted_at IS NULL
    GROUP BY l.farmer_id
  ),
  ir AS (
    SELECT i.farmer_id,
           COALESCE(SUM(GREATEST(COALESCE(i.due_amount, 0), 0)), 0) AS irr_due
    FROM public.irrigation_invoices i
    INNER JOIN visible_farmers vf ON vf.id = i.farmer_id
    WHERE i.deleted_at IS NULL
      AND COALESCE(i.invoice_status::text, '') <> 'cancelled'
    GROUP BY i.farmer_id
  ),
  sv AS (
    SELECT s.farmer_id,
           COALESCE(SUM(CASE
             WHEN s.type='deposit' AND s.status='approved' THEN s.amount
             WHEN s.type='withdraw' AND s.status='approved' THEN -s.amount
             ELSE 0
           END), 0) AS savings_bal
    FROM public.savings_transactions s
    INNER JOIN visible_farmers vf ON vf.id = s.farmer_id
    WHERE s.deleted_at IS NULL
    GROUP BY s.farmer_id
  )
  SELECT vf.id AS farmer_id,
         COALESCE(ld.loan_due, 0) AS loan_due,
         COALESCE(ir.irr_due, 0) AS irr_due,
         COALESCE(sv.savings_bal, 0) AS savings_bal,
         COALESCE(ld.loan_due, 0) + COALESCE(ir.irr_due, 0) AS net_due
  FROM visible_farmers vf
  LEFT JOIN ld ON ld.farmer_id = vf.id
  LEFT JOIN ir ON ir.farmer_id = vf.id
  LEFT JOIN sv ON sv.farmer_id = vf.id;
$function$;

REVOKE ALL ON FUNCTION public.farmer_dues_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.farmer_dues_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_dues_summary() TO service_role;

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
    SELECT COALESCE(SUM(GREATEST(COALESCE(l.principal, l.total_payable, 0) - COALESCE(p.principal_paid, 0), 0)), 0) AS loan_due
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
    SELECT COALESCE(SUM(GREATEST(COALESCE(due_amount, 0), 0)), 0) AS irrigation_due
    FROM public.irrigation_invoices
    WHERE farmer_id = _farmer_id
      AND deleted_at IS NULL
      AND COALESCE(invoice_status::text, '') <> 'cancelled'
  )
  SELECT _farmer_id,
         sv.savings_balance,
         sv.share_balance,
         ld.loan_due,
         ir.irrigation_due,
         ld.loan_due + ir.irrigation_due AS net_due
  FROM sv, ld, ir;
$function$;

REVOKE ALL ON FUNCTION public.farmer_dues_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.farmer_dues_breakdown(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_dues_breakdown(uuid) TO service_role;