CREATE OR REPLACE FUNCTION public.data_integrity_scan()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  v_section jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- savings
  SELECT jsonb_build_object(
    'null_farmer', (SELECT count(*) FROM savings_transactions WHERE farmer_id IS NULL),
    'orphan_farmer', (SELECT count(*) FROM savings_transactions s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL),
    'samples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'farmer_id',s.farmer_id,'amount',s.amount,'txn_date',s.txn_date))
      FROM (SELECT * FROM savings_transactions s WHERE s.farmer_id IS NULL OR NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=s.farmer_id) LIMIT 50) s), '[]'::jsonb)
  ) INTO v_section;
  result := result || jsonb_build_object('savings', v_section);

  -- loans
  SELECT jsonb_build_object(
    'null_farmer', (SELECT count(*) FROM loans WHERE farmer_id IS NULL),
    'orphan_farmer', (SELECT count(*) FROM loans s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL),
    'samples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'farmer_id',s.farmer_id,'principal',s.principal,'issued_on',s.issued_on))
      FROM (SELECT * FROM loans s WHERE s.farmer_id IS NULL OR NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=s.farmer_id) LIMIT 50) s), '[]'::jsonb)
  ) INTO v_section;
  result := result || jsonb_build_object('loans', v_section);

  -- loan_payments (orphan loan)
  SELECT jsonb_build_object(
    'orphan_loan', (SELECT count(*) FROM loan_payments lp LEFT JOIN loans l ON l.id=lp.loan_id WHERE l.id IS NULL),
    'samples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',lp.id,'loan_id',lp.loan_id,'amount',lp.amount,'paid_on',lp.paid_on))
      FROM (SELECT * FROM loan_payments lp WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.id=lp.loan_id) LIMIT 50) lp), '[]'::jsonb)
  ) INTO v_section;
  result := result || jsonb_build_object('loan_payments', v_section);

  -- irrigation
  SELECT jsonb_build_object(
    'null_farmer', (SELECT count(*) FROM irrigation_charges WHERE farmer_id IS NULL),
    'orphan_farmer', (SELECT count(*) FROM irrigation_charges s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL),
    'samples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'farmer_id',s.farmer_id,'total',s.total,'entry_date',s.entry_date))
      FROM (SELECT * FROM irrigation_charges s WHERE s.farmer_id IS NULL OR NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=s.farmer_id) LIMIT 50) s), '[]'::jsonb)
  ) INTO v_section;
  result := result || jsonb_build_object('irrigation', v_section);

  -- payments
  SELECT jsonb_build_object(
    'null_farmer', (SELECT count(*) FROM payments WHERE farmer_id IS NULL),
    'orphan_farmer', (SELECT count(*) FROM payments s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL),
    'samples', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'farmer_id',s.farmer_id,'amount',s.amount,'kind',s.kind,'created_at',s.created_at))
      FROM (SELECT * FROM payments s WHERE s.farmer_id IS NULL OR NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=s.farmer_id) LIMIT 50) s), '[]'::jsonb)
  ) INTO v_section;
  result := result || jsonb_build_object('payments', v_section);

  -- ledger orphans (savings/loan/loan_payment/irrigation refs)
  SELECT jsonb_build_object(
    'orphan_savings', (SELECT count(*) FROM ledger_entries WHERE reference_type IN ('savings','savings_transaction') AND reference_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM savings_transactions s WHERE s.id = ledger_entries.reference_id)),
    'orphan_loan', (SELECT count(*) FROM ledger_entries WHERE reference_type = 'loan' AND reference_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM loans s WHERE s.id = ledger_entries.reference_id)),
    'orphan_loan_payment', (SELECT count(*) FROM ledger_entries WHERE reference_type = 'loan_payment' AND reference_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM loan_payments s WHERE s.id = ledger_entries.reference_id)),
    'orphan_irrigation', (SELECT count(*) FROM ledger_entries WHERE reference_type = 'irrigation' AND reference_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM irrigation_charges s WHERE s.id = ledger_entries.reference_id))
  ) INTO v_section;
  result := result || jsonb_build_object('ledger', v_section);

  result := result || jsonb_build_object('generated_at', now());
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.data_integrity_scan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.data_integrity_scan() TO authenticated;