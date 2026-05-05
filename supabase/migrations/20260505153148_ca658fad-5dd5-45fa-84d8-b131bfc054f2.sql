
-- Truncate all tables except auth.users, profiles, user_roles, role_permissions
TRUNCATE TABLE
  public.payment_allocations,
  public.payments,
  public.loan_payments,
  public.loan_installments,
  public.loans,
  public.loan_plans,
  public.irrigation_charges,
  public.irrigation_rates,
  public.farmer_savings_plans,
  public.farmer_otps,
  public.farmer_portal_sessions,
  public.farmer_rejections,
  public.land_relations,
  public.lands,
  public.farmers,
  public.qr_tokens,
  public.notifications,
  public.audit_logs,
  public.import_audit_logs,
  public.expenses,
  public.journal_entry_lines,
  public.journal_entries,
  public.ledger_entries,
  public.accounting_periods,
  public.accounts,
  public.offices,
  public.divisions,
  public.districts
RESTART IDENTITY CASCADE;

-- Also clear additional location/config tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='upazilas') THEN
    EXECUTE 'TRUNCATE TABLE public.upazilas RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='unions') THEN
    EXECUTE 'TRUNCATE TABLE public.unions RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wards') THEN
    EXECUTE 'TRUNCATE TABLE public.wards RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='villages') THEN
    EXECUTE 'TRUNCATE TABLE public.villages RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mouzas') THEN
    EXECUTE 'TRUNCATE TABLE public.mouzas RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='seasons') THEN
    EXECUTE 'TRUNCATE TABLE public.seasons RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_withdraw_requests') THEN
    EXECUTE 'TRUNCATE TABLE public.savings_withdraw_requests RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='savings_plans') THEN
    EXECUTE 'TRUNCATE TABLE public.savings_plans RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Reset settings tables to defaults (keep row id=1)
DELETE FROM public.company_settings WHERE id <> 1;
DELETE FROM public.card_settings WHERE id <> 1;
DELETE FROM public.qr_rotation_settings WHERE id <> 1;
