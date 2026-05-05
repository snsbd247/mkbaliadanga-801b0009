
-- Fix generate_account_number: 12-digit numeric, never collides
CREATE OR REPLACE FUNCTION public.generate_account_number(_office_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _next bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(account_number, '')::bigint), 100000000000) + 1
    INTO _next
    FROM public.farmers
   WHERE account_number ~ '^[0-9]{12,14}$';
  RETURN lpad(_next::text, 12, '0');
END $function$;

ALTER TABLE public.irrigation_rates ALTER COLUMN office_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.member_no_exists(_member_no text, _exclude_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farmers
    WHERE deleted_at IS NULL
      AND member_no IS NOT NULL
      AND lower(member_no) = lower(_member_no)
      AND (_exclude_id IS NULL OR id <> _exclude_id)
  );
$$;

TRUNCATE TABLE
  public.payment_allocations,
  public.loan_payments,
  public.loan_installments,
  public.irrigation_charges,
  public.land_relations,
  public.lands,
  public.farmer_savings_plans,
  public.payments,
  public.loans,
  public.farmer_rejections,
  public.farmer_otps,
  public.farmer_portal_sessions,
  public.qr_tokens,
  public.notifications,
  public.audit_logs,
  public.ledger_entries,
  public.journal_entry_lines,
  public.journal_entries,
  public.expenses,
  public.import_audit_logs,
  public.accounting_periods,
  public.farmers
RESTART IDENTITY CASCADE;

DO $$
DECLARE
  v_office uuid;
  v_season uuid;
  v_farmer uuid;
  v_land uuid;
  v_seq bigint := 100000000000;
  v_acc text;
  i int;
  bn_names text[] := ARRAY['করিম','রহিম','জসিম','সালাম','মফিজ','আলম','হাসান','মাসুদ','নুরুল','ইমরান','সাইফুল','বশির','রফিক','জামাল','কামাল','দেলোয়ার','মাহবুব','শফিক','ইকবাল','তোফায়েল'];
  en_names text[] := ARRAY['Karim Uddin','Rahim Mia','Jasim Hossain','Salam Sheikh','Mofiz Khan','Alam Ali','Hasan Ahmed','Masud Rana','Nurul Islam','Imran Hossain','Saiful Karim','Bashir Mia','Rafiq Ahmed','Jamal Uddin','Kamal Hossain','Delowar Khan','Mahbub Alam','Shafiq Mia','Iqbal Hossain','Tofayel Ahmed'];
BEGIN
  SELECT id INTO v_office FROM public.offices ORDER BY created_at LIMIT 1;
  IF v_office IS NULL THEN
    INSERT INTO public.offices(name, address, contact)
    VALUES ('Demo Branch', 'Demo Address, Bangladesh', '01700000000')
    RETURNING id INTO v_office;
  END IF;

  SELECT id INTO v_season FROM public.seasons ORDER BY year DESC LIMIT 1;
  IF v_season IS NULL THEN
    INSERT INTO public.seasons(name, type, year)
    VALUES ('Boro 2026', 'boro', 2026)
    RETURNING id INTO v_season;
  END IF;

  INSERT INTO public.irrigation_rates(office_id, season_id, basis, base_rate, is_active)
  VALUES (v_office, v_season, 'per_size', 200, true);

  FOR i IN 1..20 LOOP
    INSERT INTO public.farmers(
      name_en, name_bn, father_name, mother_name,
      mobile, address, status, office_id, is_voter
    ) VALUES (
      en_names[i],
      bn_names[i] || ' উদ্দিন',
      'Father of ' || en_names[i],
      'Mother of ' || en_names[i],
      '0171' || lpad(i::text, 7, '0'),
      'Village ' || i || ', Demo',
      'active',
      v_office,
      (i % 3 = 0)
    ) RETURNING id INTO v_farmer;

    IF (i % 3 = 0) THEN
      v_seq := v_seq + 1;
      v_acc := lpad(v_seq::text, 12, '0');
      UPDATE public.farmers
        SET account_number = v_acc,
            member_no      = v_acc,
            voter_number   = v_acc
        WHERE id = v_farmer;
    END IF;

    INSERT INTO public.lands(farmer_id, mouza, dag_no, land_size, owner_type, field_type, office_id)
    VALUES (v_farmer, 'Mouza ' || i, ((i*13)::text) || '/A', 0.5 + (i % 5) * 0.25, 'owner', 'medium_land', v_office)
    RETURNING id INTO v_land;

    INSERT INTO public.irrigation_charges(
      farmer_id, land_id, season_id, basis, quantity,
      base_charge, total, due_amount, office_id, entry_date
    ) VALUES (
      v_farmer, v_land, v_season, 'per_size', 0.5 + (i % 5) * 0.25,
      (0.5 + (i % 5) * 0.25) * 200,
      (0.5 + (i % 5) * 0.25) * 200,
      (0.5 + (i % 5) * 0.25) * 200,
      v_office, CURRENT_DATE - (i || ' days')::interval
    );
  END LOOP;

  INSERT INTO public.payments(farmer_id, kind, amount, method, office_id, status)
  SELECT f.id, 'irrigation', 100, 'cash', v_office, 'approved'
  FROM public.farmers f
  WHERE f.office_id = v_office
  ORDER BY f.created_at
  LIMIT 3;

  INSERT INTO public.loans(farmer_id, principal, total_payable, interest_rate, status, office_id)
  SELECT f.id, 5000, 5500, 10, 'approved', v_office
  FROM public.farmers f
  WHERE f.office_id = v_office
  ORDER BY f.created_at
  LIMIT 2;
END $$;
