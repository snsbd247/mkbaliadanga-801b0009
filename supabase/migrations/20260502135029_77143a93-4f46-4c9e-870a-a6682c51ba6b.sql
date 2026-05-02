-- ============================================================
-- FULL DATA RESET + RAJSHAHI LOCATION TOP-UP + DEMO SEED
-- ============================================================

TRUNCATE TABLE
  public.qr_tokens, public.farmer_otps, public.farmer_portal_sessions,
  public.payment_allocations, public.payments, public.loan_payments, public.receipts,
  public.irrigation_charges, public.loans, public.savings_transactions,
  public.savings_yearly_opening, public.shares,
  public.ledger_entries, public.journal_entry_lines, public.journal_entries,
  public.expenses, public.notifications, public.sms_logs, public.audit_logs,
  public.land_relations, public.lands, public.farmers
RESTART IDENTITY CASCADE;

ALTER SEQUENCE IF EXISTS public.farmer_code_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.member_no_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.receipt_no_seq RESTART WITH 1;

-- Rajshahi unions (3 per upazila)
WITH raj_upazilas AS (
  SELECT u.id AS upazila_id, u.name AS upazila_name
  FROM public.upazilas u
  JOIN public.districts d ON d.id = u.district_id
  WHERE d.division_id = (SELECT id FROM public.divisions WHERE name='Rajshahi')
),
union_seed AS (
  SELECT upazila_id, (upazila_name || ' Union ' || n) AS uname, ('ইউনিয়ন ' || n) AS uname_bn
  FROM raj_upazilas, generate_series(1,3) AS n
)
INSERT INTO public.unions (upazila_id, name, name_bn, is_active)
SELECT upazila_id, uname, uname_bn, true FROM union_seed
ON CONFLICT (upazila_id, name) DO NOTHING;

-- Rajshahi wards (9 per union)
WITH raj_unions AS (
  SELECT un.id AS union_id FROM public.unions un
  JOIN public.upazilas up ON up.id = un.upazila_id
  JOIN public.districts d ON d.id = up.district_id
  WHERE d.division_id = (SELECT id FROM public.divisions WHERE name='Rajshahi')
)
INSERT INTO public.wards (union_id, name, name_bn, is_active)
SELECT u.union_id, ('Ward ' || n), ('ওয়ার্ড ' || n), true
FROM raj_unions u, generate_series(1,9) AS n
ON CONFLICT (union_id, name) DO NOTHING;

-- Rajshahi mouzas (2 per union)
WITH raj_unions AS (
  SELECT un.id AS union_id, un.name AS uname FROM public.unions un
  JOIN public.upazilas up ON up.id = un.upazila_id
  JOIN public.districts d ON d.id = up.district_id
  WHERE d.division_id = (SELECT id FROM public.divisions WHERE name='Rajshahi')
)
INSERT INTO public.mouzas (union_id, name, name_bn, jl_no, is_active)
SELECT union_id, (uname || ' Mouza ' || n), ('মৌজা ' || n), (100+n)::text, true
FROM raj_unions, generate_series(1,2) AS n
ON CONFLICT DO NOTHING;

-- Demo seed
DO $seed$
DECLARE
  v_admin uuid := (SELECT user_id FROM public.user_roles WHERE role='super_admin' LIMIT 1);
  v_office uuid := (SELECT id FROM public.offices LIMIT 1);
  v_division uuid := (SELECT id FROM public.divisions WHERE name='Rajshahi');
  v_season uuid := (SELECT id FROM public.seasons WHERE year=2026 LIMIT 1);
  v_districts uuid[];
  v_farmer_id uuid; v_land_id uuid; v_loan_id uuid;
  i int; j int;
  v_district uuid; v_upazila uuid; v_union uuid; v_ward uuid; v_mouza uuid;
  v_district_name text; v_upazila_name text;

  fnames_en text[] := ARRAY[
    'Abdul Karim','Mohammad Rahim','Abdus Salam','Nurul Islam','Md. Shahidul Islam',
    'Rafiqul Islam','Abdur Rahman','Md. Aslam Hossain','Jahangir Alam','Mizanur Rahman',
    'Md. Habibur Rahman','Anwar Hossain','Sohel Rana','Bashir Ahmed','Kamal Hossain',
    'Md. Faruk Mia','Saiful Islam','Abu Taher','Ruhul Amin','Md. Liakat Ali',
    'Hafizur Rahman','Md. Shamsul Haque','Lutfor Rahman','Aminul Islam','Babul Akter',
    'Md. Yunus Ali','Tofazzal Hossain','Rezaul Karim','Ataur Rahman','Md. Belal Hossain'];
  fnames_bn text[] := ARRAY[
    'আব্দুল করিম','মোহাম্মদ রহিম','আব্দুস সালাম','নুরুল ইসলাম','মোঃ শহিদুল ইসলাম',
    'রফিকুল ইসলাম','আব্দুর রহমান','মোঃ আসলাম হোসেন','জাহাঙ্গীর আলম','মিজানুর রহমান',
    'মোঃ হাবিবুর রহমান','আনোয়ার হোসেন','সোহেল রানা','বশির আহমেদ','কামাল হোসেন',
    'মোঃ ফারুক মিয়া','সাইফুল ইসলাম','আবু তাহের','রুহুল আমিন','মোঃ লিয়াকত আলী',
    'হাফিজুর রহমান','মোঃ শামসুল হক','লুৎফর রহমান','আমিনুল ইসলাম','বাবুল আক্তার',
    'মোঃ ইউনুস আলী','তোফাজ্জল হোসেন','রেজাউল করিম','আতাউর রহমান','মোঃ বেলাল হোসেন'];
  fathers text[] := ARRAY[
    'Late Abdul Hamid','Late Abdul Jabbar','Late Mohammad Ali','Late Hossain Ali','Late Abdul Mannan',
    'Late Ismail Hossain','Late Sirajul Islam','Late Tofail Ahmed','Late Abdul Khaleque','Late Akkas Ali'];
  mothers text[] := ARRAY[
    'Mst. Rahima Begum','Mst. Salma Khatun','Mst. Hasina Begum','Mst. Roksana Begum','Mst. Anwara Begum'];
BEGIN
  SELECT array_agg(id) INTO v_districts FROM public.districts WHERE division_id = v_division;

  FOR i IN 1..30 LOOP
    v_district := v_districts[1 + ((i-1) % array_length(v_districts,1))];
    SELECT id, name INTO v_upazila, v_upazila_name FROM public.upazilas
      WHERE district_id = v_district ORDER BY md5(i::text || id::text) LIMIT 1;
    SELECT name INTO v_district_name FROM public.districts WHERE id = v_district;
    SELECT id INTO v_union FROM public.unions WHERE upazila_id = v_upazila ORDER BY md5(i::text || id::text) LIMIT 1;
    SELECT id INTO v_ward  FROM public.wards  WHERE union_id   = v_union   ORDER BY md5(i::text || id::text) LIMIT 1;
    SELECT id INTO v_mouza FROM public.mouzas WHERE union_id   = v_union   ORDER BY md5(i::text || id::text) LIMIT 1;

    INSERT INTO public.farmers (
      name_en, name_bn, father_name, mother_name, mobile, nid,
      address, division, district, upazila, village, photo_url,
      office_id, status, created_by,
      division_id, district_id, upazila_id, union_id, ward_id, mouza_id,
      farmer_code
    ) VALUES (
      fnames_en[i], fnames_bn[i],
      fathers[1 + ((i-1) % array_length(fathers,1))],
      mothers[1 + ((i-1) % array_length(mothers,1))],
      '01' || (7 + (i % 3))::text || lpad((10000000 + i*131)::text, 8, '0'),
      lpad((1000000000 + i*7919)::text, 13, '0'),
      'Village ' || i || ', ' || v_district_name,
      'Rajshahi', v_district_name, v_upazila_name, 'Village ' || i,
      'https://i.pravatar.cc/150?img=' || ((i % 70) + 1),
      v_office, 'active', v_admin,
      v_division, v_district, v_upazila, v_union, v_ward, v_mouza,
      'MK-' || lpad(i::text, 5, '0')
    ) RETURNING id INTO v_farmer_id;

    INSERT INTO public.lands (
      farmer_id, land_size, dag_no, mouza, mouza_id, office_id, field_type, owner_type
    ) VALUES (
      v_farmer_id,
      round((0.3 + (i % 7) * 0.45)::numeric, 2),
      'Dag-' || (1000 + i),
      'Mouza ' || ((i % 5) + 1),
      v_mouza, v_office,
      (ARRAY['high_land','medium_land','low_land']::field_type[])[1 + (i % 3)],
      (ARRAY['owner','borgadar']::owner_type[])[1 + (i % 2)]
    ) RETURNING id INTO v_land_id;

    -- Savings deposits
    FOR j IN 1..4 LOOP
      INSERT INTO public.savings_transactions (
        farmer_id, type, amount, txn_date, status, office_id, created_by, note
      ) VALUES (
        v_farmer_id, 'deposit',
        500 + ((i*j) % 10) * 250,
        (CURRENT_DATE - ((12 - j*2) || ' months')::interval)::date,
        'approved', v_office, v_admin, 'Monthly deposit'
      );
    END LOOP;

    IF i % 3 = 0 THEN
      INSERT INTO public.savings_transactions (
        farmer_id, type, amount, txn_date, status, office_id, created_by, note
      ) VALUES (
        v_farmer_id, 'withdraw', 500,
        (CURRENT_DATE - INTERVAL '2 months')::date,
        'approved', v_office, v_admin, 'Emergency withdrawal'
      );
    END IF;

    IF v_season IS NOT NULL THEN
      INSERT INTO public.irrigation_charges (
        farmer_id, land_id, season_id, basis, quantity,
        base_charge, canal_charge, maintenance_charge, other_charge,
        paid_amount, entry_date, office_id, created_by, note
      ) VALUES (
        v_farmer_id, v_land_id, v_season, 'per_size',
        (SELECT land_size FROM public.lands WHERE id = v_land_id),
        1500 + (i % 5) * 200, 300, 200, 0,
        CASE WHEN i % 3 = 0 THEN 0 WHEN i % 3 = 1 THEN 1000 ELSE 2000 END,
        (CURRENT_DATE - INTERVAL '1 month')::date,
        v_office, v_admin, 'Boro 2026 irrigation'
      );
    END IF;
  END LOOP;

  -- Loans
  FOR i IN 1..15 LOOP
    SELECT id INTO v_farmer_id FROM public.farmers ORDER BY farmer_code OFFSET (i-1) LIMIT 1;

    INSERT INTO public.loans (
      farmer_id, principal, interest_rate, interest_enabled,
      issued_on, status, office_id, created_by, note
    ) VALUES (
      v_farmer_id,
      10000 + (i % 6) * 5000,
      10, true,
      (CURRENT_DATE - ((6 - (i % 6)) || ' months')::interval)::date,
      'approved', v_office, v_admin, 'Demo loan ' || i
    ) RETURNING id INTO v_loan_id;

    IF i BETWEEN 6 AND 10 THEN
      INSERT INTO public.loan_payments (loan_id, amount, paid_on, status, office_id, collected_by)
      SELECT v_loan_id,
             round((total_payable * (0.3 + (i % 3) * 0.1))::numeric, 2),
             (CURRENT_DATE - INTERVAL '1 month')::date,
             'approved', v_office, v_admin
      FROM public.loans WHERE id = v_loan_id;
    ELSIF i BETWEEN 11 AND 15 THEN
      INSERT INTO public.loan_payments (loan_id, amount, paid_on, status, office_id, collected_by)
      SELECT v_loan_id, total_payable,
             (CURRENT_DATE - INTERVAL '15 days')::date,
             'approved', v_office, v_admin
      FROM public.loans WHERE id = v_loan_id;
    END IF;
  END LOOP;

  -- QR tokens
  INSERT INTO public.qr_tokens (farmer_id, token, revoked, created_by)
  SELECT id, encode(gen_random_bytes(24), 'hex'), false, v_admin FROM public.farmers;
END $seed$;

-- Verification
DO $verify$
DECLARE
  v_farmers int; v_loans int; v_qr int; v_ledger_diff numeric;
BEGIN
  SELECT count(*) INTO v_farmers FROM public.farmers;
  SELECT count(*) INTO v_loans   FROM public.loans;
  SELECT count(*) INTO v_qr      FROM public.qr_tokens;
  SELECT coalesce(sum(debit) - sum(credit), 0) INTO v_ledger_diff FROM public.ledger_entries;

  IF v_farmers <> 30 THEN RAISE EXCEPTION 'Expected 30 farmers, got %', v_farmers; END IF;
  IF v_loans   <> 15 THEN RAISE EXCEPTION 'Expected 15 loans, got %', v_loans; END IF;
  IF v_qr      <> 30 THEN RAISE EXCEPTION 'Expected 30 qr tokens, got %', v_qr; END IF;
  IF abs(v_ledger_diff) > 0.01 THEN
    RAISE EXCEPTION 'Ledger imbalance: %', v_ledger_diff;
  END IF;
END $verify$;