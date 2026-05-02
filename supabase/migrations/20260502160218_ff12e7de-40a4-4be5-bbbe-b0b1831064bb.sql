
DO $seed$
DECLARE
  v_office uuid := (SELECT id FROM offices LIMIT 1);
  v_super  uuid := (SELECT user_id FROM user_roles WHERE role='super_admin' LIMIT 1);
  v_season uuid := (SELECT id FROM seasons ORDER BY year DESC LIMIT 1);
  v_division uuid := (SELECT id FROM divisions WHERE name ILIKE 'Rajshahi' LIMIT 1);

  a_cash uuid := (SELECT id FROM accounts WHERE code='1010');
  a_sav_liab  uuid := (SELECT id FROM accounts WHERE code='2010');
  a_loan_recv uuid := (SELECT id FROM accounts WHERE code='1040');
  a_irr_recv  uuid := (SELECT id FROM accounts WHERE code='1050');
  a_irr_inc   uuid := (SELECT id FROM accounts WHERE code='4010');

  i int; j int;
  v_farmer_id uuid; v_land_id uuid; v_loan_id uuid; v_irr_id uuid; v_payment_id uuid;
  v_loan_principal numeric; v_loan_total numeric; v_loan_rate numeric; v_loan_paid numeric;
  v_district uuid; v_upazila uuid; v_union uuid; v_ward uuid; v_village uuid; v_mouza uuid;
  v_dist_name text; v_upa_name text; v_uni_name text;
  v_n_savings int; v_amt numeric;
  v_total_imbalance numeric; v_loan_kind text; v_size numeric; v_field text;
  v_irr_total numeric; v_irr_paid numeric;
  v_total_deposits numeric;
BEGIN
  IF v_super IS NULL THEN RAISE EXCEPTION 'No super_admin user found'; END IF;

  FOR i IN 1..30 LOOP
    SELECT d.id, up.id, un.id, w.id, v.id, m.id, d.name, up.name, un.name
      INTO v_district, v_upazila, v_union, v_ward, v_village, v_mouza,
           v_dist_name, v_upa_name, v_uni_name
    FROM districts d
    JOIN upazilas up ON up.district_id = d.id
    JOIN unions un  ON un.upazila_id = up.id
    JOIN wards w    ON w.union_id = un.id
    JOIN villages v ON v.ward_id = w.id
    JOIN mouzas m   ON m.union_id = un.id AND (m.ward_id IS NULL OR m.ward_id = w.id)
    WHERE d.division_id = v_division
    ORDER BY md5(i::text || d.id::text || w.id::text)
    LIMIT 1;

    IF v_mouza IS NULL THEN
      RAISE EXCEPTION 'No valid Rajshahi location chain found for farmer %', i;
    END IF;

    INSERT INTO farmers (
      farmer_code, member_no, name_en, name_bn, father_name, mother_name,
      mobile, nid, address, photo_url, status, office_id, created_by,
      division_id, district_id, upazila_id, union_id, ward_id, village_id, mouza_id,
      division, district, upazila, village
    ) VALUES (
      'MK-' || lpad(i::text, 4, '0'),
      'M-' || lpad(i::text, 4, '0'),
      'Demo Farmer ' || i,
      'কৃষক ' || i,
      'Father ' || i,
      'Mother ' || i,
      '017' || lpad((10000000 + i)::text, 8, '0'),
      lpad((1990000000000 + i)::text, 13, '0'),
      'Village ' || i || ', ' || v_uni_name || ', ' || v_upa_name || ', ' || v_dist_name,
      'https://placehold.co/200x200?text=F' || i,
      'active', v_office, v_super,
      v_division, v_district, v_upazila, v_union, v_ward, v_village, v_mouza,
      'Rajshahi', v_dist_name, v_upa_name, 'Village ' || i
    ) RETURNING id INTO v_farmer_id;

    FOR j IN 1..(1 + (i % 2)) LOOP
      v_size := round((0.3 + (random() * 3.2))::numeric, 2);
      v_field := (ARRAY['high_land','medium_land','low_land'])[1 + ((i + j) % 3)];
      INSERT INTO lands (farmer_id, mouza, dag_no, land_size, field_type, owner_type, office_id, mouza_id)
      VALUES (v_farmer_id, 'Mouza ' || i, 'D' || (100 + i*10 + j), v_size, v_field::field_type,
              CASE WHEN (i+j) % 4 = 0 THEN 'borgadar' ELSE 'owner' END::owner_type,
              v_office, v_mouza)
      RETURNING id INTO v_land_id;
    END LOOP;

    v_n_savings := 4 + (i % 4);
    v_total_deposits := 0;
    FOR j IN 1..v_n_savings LOOP
      v_amt := (500 + floor(random() * 2500))::numeric;
      v_total_deposits := v_total_deposits + v_amt;
      INSERT INTO savings_transactions (farmer_id, type, amount, status, txn_date, created_by, approved_by, office_id, note)
      VALUES (v_farmer_id, 'deposit', v_amt, 'approved',
              (CURRENT_DATE - ((random()*365)::int)), v_super, v_super, v_office, 'Demo deposit')
      RETURNING id INTO v_payment_id;

      INSERT INTO ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
      VALUES (CURRENT_DATE, a_cash, v_amt, 0, 'savings', v_payment_id, 'Savings deposit', v_office, v_super),
             (CURRENT_DATE, a_sav_liab, 0, v_amt, 'savings', v_payment_id, 'Savings deposit', v_office, v_super);
    END LOOP;

    IF i % 3 = 0 AND v_total_deposits > 1000 THEN
      v_amt := round((v_total_deposits * 0.1)::numeric, 0);
      INSERT INTO savings_transactions (farmer_id, type, amount, status, txn_date, created_by, approved_by, office_id, note)
      VALUES (v_farmer_id, 'withdraw', v_amt, 'approved',
              CURRENT_DATE - 1, v_super, v_super, v_office, 'Demo withdrawal')
      RETURNING id INTO v_payment_id;

      INSERT INTO ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
      VALUES (CURRENT_DATE, a_sav_liab, v_amt, 0, 'savings', v_payment_id, 'Savings withdrawal', v_office, v_super),
             (CURRENT_DATE, a_cash, 0, v_amt, 'savings', v_payment_id, 'Savings withdrawal', v_office, v_super);
    END IF;

    INSERT INTO qr_tokens (farmer_id, token, revoked, created_by)
    VALUES (v_farmer_id, encode(gen_random_bytes(16), 'hex'), false, v_super);

    v_irr_total := round((800 + random() * 2200)::numeric, 0);
    v_irr_paid  := CASE WHEN i % 3 = 0 THEN 0
                        WHEN i % 3 = 1 THEN round((v_irr_total * 0.5)::numeric, 0)
                        ELSE v_irr_total END;
    INSERT INTO irrigation_charges (
      farmer_id, land_id, season_id, basis, quantity,
      base_charge, canal_charge, maintenance_charge, other_charge,
      total, paid_amount, due_amount, entry_date, office_id, created_by
    ) VALUES (
      v_farmer_id, v_land_id, v_season, 'per_size', v_size,
      v_irr_total - 200, 100, 50, 50,
      v_irr_total, v_irr_paid, v_irr_total - v_irr_paid,
      CURRENT_DATE - (i % 60), v_office, v_super
    ) RETURNING id INTO v_irr_id;

    INSERT INTO ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
    VALUES (CURRENT_DATE, a_irr_recv, v_irr_total, 0, 'irrigation', v_irr_id, 'Irrigation charge', v_office, v_super),
           (CURRENT_DATE, a_irr_inc, 0, v_irr_total, 'irrigation', v_irr_id, 'Irrigation income', v_office, v_super);

    IF v_irr_paid > 0 THEN
      INSERT INTO payments (farmer_id, kind, reference_id, amount, method, status, office_id, collected_by, approved_by, approved_at)
      VALUES (v_farmer_id, 'irrigation', v_irr_id, v_irr_paid, 'cash', 'approved', v_office, v_super, v_super, now())
      RETURNING id INTO v_payment_id;

      INSERT INTO receipts (receipt_no, kind, farmer_id, reference_id, amount, method, receipt_date, office_id, collected_by)
      VALUES ('R-' || to_char(now(),'YYYYMMDD') || '-I' || lpad(i::text,4,'0'),
              'irrigation', v_farmer_id, v_irr_id, v_irr_paid, 'cash', CURRENT_DATE, v_office, v_super);

      INSERT INTO payment_allocations (payment_id, kind, reference_id, amount, office_id)
      VALUES (v_payment_id, 'irrigation', v_irr_id, v_irr_paid, v_office);

      INSERT INTO ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
      VALUES (CURRENT_DATE, a_cash, v_irr_paid, 0, 'payment', v_payment_id, 'Irrigation collection', v_office, v_super),
             (CURRENT_DATE, a_irr_recv, 0, v_irr_paid, 'payment', v_payment_id, 'Irrigation collection', v_office, v_super);
    END IF;
  END LOOP;

  FOR i IN 1..15 LOOP
    SELECT id INTO v_farmer_id FROM farmers WHERE farmer_code = 'MK-' || lpad(i::text, 4, '0');
    v_loan_principal := (5000 + (i * 1000))::numeric;
    v_loan_rate := 8 + (i % 5);
    v_loan_total := round((v_loan_principal * (1 + v_loan_rate/100.0))::numeric, 2);

    IF i BETWEEN 1 AND 5 THEN
      v_loan_paid := 0; v_loan_kind := 'approved';
    ELSIF i BETWEEN 6 AND 10 THEN
      v_loan_paid := round((v_loan_total * (0.3 + (random()*0.3)))::numeric, 2); v_loan_kind := 'approved';
    ELSE
      v_loan_paid := v_loan_total; v_loan_kind := 'paid';
    END IF;

    INSERT INTO loans (farmer_id, principal, interest_enabled, interest_rate, total_payable,
                       issued_on, next_due_on, status, approved_by, created_by, office_id, note)
    VALUES (v_farmer_id, v_loan_principal, true, v_loan_rate, v_loan_total,
            CURRENT_DATE - ((30 + i*7)::int), CURRENT_DATE + 30,
            v_loan_kind::loan_status, v_super, v_super, v_office, 'Demo loan')
    RETURNING id INTO v_loan_id;

    INSERT INTO ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
    VALUES (CURRENT_DATE, a_loan_recv, v_loan_principal, 0, 'loan', v_loan_id, 'Loan disbursement', v_office, v_super),
           (CURRENT_DATE, a_cash, 0, v_loan_principal, 'loan', v_loan_id, 'Loan disbursement', v_office, v_super);

    IF v_loan_paid > 0 THEN
      INSERT INTO loan_payments (loan_id, amount, paid_on, status, collected_by, approved_by, approved_at, office_id)
      VALUES (v_loan_id, v_loan_paid, CURRENT_DATE - 5, 'approved', v_super, v_super, now(), v_office);

      INSERT INTO payments (farmer_id, kind, reference_id, amount, method, status, office_id, collected_by, approved_by, approved_at)
      VALUES (v_farmer_id, 'loan', v_loan_id, v_loan_paid, 'cash', 'approved', v_office, v_super, v_super, now())
      RETURNING id INTO v_payment_id;

      INSERT INTO receipts (receipt_no, kind, farmer_id, reference_id, amount, method, receipt_date, office_id, collected_by, note)
      VALUES ('R-' || to_char(now(),'YYYYMMDD') || '-L' || lpad(i::text,4,'0'),
              'other', v_farmer_id, v_loan_id, v_loan_paid, 'cash', CURRENT_DATE, v_office, v_super, 'Loan repayment');

      INSERT INTO payment_allocations (payment_id, kind, reference_id, amount, office_id)
      VALUES (v_payment_id, 'loan', v_loan_id, v_loan_paid, v_office);

      INSERT INTO ledger_entries (entry_date, account_id, debit, credit, reference_type, reference_id, description, office_id, created_by)
      VALUES (CURRENT_DATE, a_cash, v_loan_paid, 0, 'loan_payment', v_loan_id, 'Loan repayment', v_office, v_super),
             (CURRENT_DATE, a_loan_recv, 0, v_loan_paid, 'loan_payment', v_loan_id, 'Loan repayment', v_office, v_super);
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM farmers) <> 30 THEN
    RAISE EXCEPTION 'Expected 30 farmers, got %', (SELECT count(*) FROM farmers);
  END IF;
  SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) INTO v_total_imbalance FROM ledger_entries;
  IF v_total_imbalance <> 0 THEN
    RAISE EXCEPTION 'Ledger out of balance: % difference', v_total_imbalance;
  END IF;
  IF (SELECT count(*) FROM qr_tokens WHERE revoked=false) <> 30 THEN
    RAISE EXCEPTION 'Expected 30 active qr_tokens';
  END IF;
END
$seed$;
