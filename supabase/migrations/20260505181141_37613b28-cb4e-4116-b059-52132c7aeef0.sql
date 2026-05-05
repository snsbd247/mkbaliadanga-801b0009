DO $$
DECLARE
  r RECORD;
  -- Functions that legitimately need to be called by authenticated users.
  auth_callable TEXT[] := ARRAY[
    'has_role','is_admin_or_super','is_committee_or_super','current_user_office',
    'email_for_username','_lookup_email_by_username',
    'farmer_savings_statement','farmer_loan_statement',
    'cancel_voter_membership','reactivate_voter_membership',
    'generate_account_number','generate_farmer_account_number','generate_farmer_voter_number',
    'generate_farmer_qr_tokens','generate_loan_installments','generate_receipt_no',
    'close_accounting_period','compute_period_summary',
    'data_integrity_scan','ledger_integrity_summary','ledger_orphan_refs','ledger_unbalanced_refs',
    'apply_loan_installment_penalties','is_date_in_closed_period',
    'list_collector_users','log_farmer_rejection',
    'activate_sms_token','get_sms_provider_status',
    'member_no_exists','share_holder_balance','share_holders_summary',
    'reconcile_share_capital','farmer_dues_summary'
  ];
  -- Functions anon should still be able to call (pre-auth login flow).
  anon_callable TEXT[] := ARRAY[
    'email_for_username','_lookup_email_by_username'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, n.nspname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
    IF r.proname = ANY(auth_callable) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
                     r.proname, r.args);
    END IF;
    IF r.proname = ANY(anon_callable) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon',
                     r.proname, r.args);
    END IF;
  END LOOP;
END $$;