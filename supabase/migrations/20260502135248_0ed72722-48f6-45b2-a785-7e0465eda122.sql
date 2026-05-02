-- ============================================================
-- 1. VILLAGES TABLE (new node in location hierarchy)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id uuid NOT NULL REFERENCES public.unions(id) ON DELETE RESTRICT,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  name text NOT NULL,
  name_bn text,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (union_id, name)
);

CREATE INDEX IF NOT EXISTS idx_villages_union ON public.villages(union_id);
CREATE INDEX IF NOT EXISTS idx_villages_ward  ON public.villages(ward_id);

ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read villages" ON public.villages;
CREATE POLICY "auth read villages" ON public.villages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super manage villages" ON public.villages;
CREATE POLICY "super manage villages" ON public.villages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP TRIGGER IF EXISTS trg_villages_touch ON public.villages;
CREATE TRIGGER trg_villages_touch BEFORE UPDATE ON public.villages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2. STRICT QR UNIQUENESS — one active token per farmer
-- ============================================================
-- token already UNIQUE globally; add partial unique on (farmer_id) WHERE NOT revoked
DROP INDEX IF EXISTS public.qr_tokens_active_idx;
DROP INDEX IF EXISTS public.idx_qr_tokens_farmer_active;

CREATE UNIQUE INDEX IF NOT EXISTS qr_tokens_one_active_per_farmer
  ON public.qr_tokens (farmer_id) WHERE revoked = false;

-- ============================================================
-- 3. seed_rajshahi_locations() — full hierarchy importer
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_rajshahi_locations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_div uuid;
  v_inserted_unions int := 0;
  v_inserted_wards int := 0;
  v_inserted_villages int := 0;
  v_inserted_mouzas int := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can seed locations';
  END IF;

  -- Division
  INSERT INTO public.divisions (name, name_bn, is_active)
  VALUES ('Rajshahi', 'রাজশাহী', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_div FROM public.divisions WHERE name='Rajshahi';

  -- Districts already national-seeded; just ensure linked
  -- Upazilas already national-seeded.

  -- Unions: 3 per upazila in Rajshahi
  WITH ins AS (
    INSERT INTO public.unions (upazila_id, name, name_bn, is_active)
    SELECT u.id,
           (u.name || ' Union ' || n),
           ('ইউনিয়ন ' || n),
           true
    FROM public.upazilas u
    JOIN public.districts d ON d.id = u.district_id
    CROSS JOIN generate_series(1,3) AS n
    WHERE d.division_id = v_div
    ON CONFLICT (upazila_id, name) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_inserted_unions FROM ins;

  -- Wards: 9 per Rajshahi union
  WITH ins AS (
    INSERT INTO public.wards (union_id, name, name_bn, is_active)
    SELECT un.id, ('Ward ' || n), ('ওয়ার্ড ' || n), true
    FROM public.unions un
    JOIN public.upazilas up ON up.id = un.upazila_id
    JOIN public.districts d ON d.id = up.district_id
    CROSS JOIN generate_series(1,9) AS n
    WHERE d.division_id = v_div
    ON CONFLICT (union_id, name) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_inserted_wards FROM ins;

  -- Villages: 4 per Rajshahi union, mapped to ward 1 by default
  WITH ranked_wards AS (
    SELECT w.id AS ward_id, w.union_id,
           ROW_NUMBER() OVER (PARTITION BY w.union_id ORDER BY w.name) AS rn
    FROM public.wards w
    JOIN public.unions un ON un.id = w.union_id
    JOIN public.upazilas up ON up.id = un.upazila_id
    JOIN public.districts d ON d.id = up.district_id
    WHERE d.division_id = v_div
  ),
  ins AS (
    INSERT INTO public.villages (union_id, ward_id, name, name_bn, is_active)
    SELECT rw.union_id, rw.ward_id,
           ('Village ' || n),
           ('গ্রাম ' || n),
           true
    FROM ranked_wards rw
    CROSS JOIN generate_series(1,4) AS n
    WHERE rw.rn = 1
    ON CONFLICT (union_id, name) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_inserted_villages FROM ins;

  -- Mouzas: 2 per Rajshahi union
  WITH ins AS (
    INSERT INTO public.mouzas (union_id, name, name_bn, jl_no, is_active)
    SELECT un.id,
           (un.name || ' Mouza ' || n),
           ('মৌজা ' || n),
           (100 + n)::text,
           true
    FROM public.unions un
    JOIN public.upazilas up ON up.id = un.upazila_id
    JOIN public.districts d ON d.id = up.district_id
    CROSS JOIN generate_series(1,2) AS n
    WHERE d.division_id = v_div
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_inserted_mouzas FROM ins;

  RETURN jsonb_build_object(
    'division', 'Rajshahi',
    'inserted_unions', v_inserted_unions,
    'inserted_wards', v_inserted_wards,
    'inserted_villages', v_inserted_villages,
    'inserted_mouzas', v_inserted_mouzas,
    'total_districts', (SELECT count(*) FROM public.districts WHERE division_id = v_div),
    'total_upazilas',  (SELECT count(*) FROM public.upazilas up
                        JOIN public.districts d ON d.id=up.district_id WHERE d.division_id=v_div),
    'total_unions',    (SELECT count(*) FROM public.unions un
                        JOIN public.upazilas up ON up.id=un.upazila_id
                        JOIN public.districts d ON d.id=up.district_id WHERE d.division_id=v_div),
    'total_wards',     (SELECT count(*) FROM public.wards w
                        JOIN public.unions un ON un.id=w.union_id
                        JOIN public.upazilas up ON up.id=un.upazila_id
                        JOIN public.districts d ON d.id=up.district_id WHERE d.division_id=v_div),
    'total_villages',  (SELECT count(*) FROM public.villages v
                        JOIN public.unions un ON un.id=v.union_id
                        JOIN public.upazilas up ON up.id=un.upazila_id
                        JOIN public.districts d ON d.id=up.district_id WHERE d.division_id=v_div),
    'total_mouzas',    (SELECT count(*) FROM public.mouzas m
                        JOIN public.unions un ON un.id=m.union_id
                        JOIN public.upazilas up ON up.id=un.upazila_id
                        JOIN public.districts d ON d.id=up.district_id WHERE d.division_id=v_div)
  );
END $$;

-- ============================================================
-- 4. verify_seed_integrity() — post-seed validator
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_seed_integrity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orphans jsonb;
  v_savings_mismatch int;
  v_loan_mismatch int;
  v_ledger_unbal_count int;
  v_ledger_diff numeric;
  v_dup_qr int;
  v_no_qr int;
  v_status text;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can run integrity verification';
  END IF;

  -- Orphan farmer references
  SELECT jsonb_build_object(
    'savings',       (SELECT count(*) FROM savings_transactions s
                      WHERE NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=s.farmer_id)),
    'loans',         (SELECT count(*) FROM loans l
                      WHERE NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=l.farmer_id)),
    'loan_payments', (SELECT count(*) FROM loan_payments lp
                      WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.id=lp.loan_id)),
    'irrigation',    (SELECT count(*) FROM irrigation_charges i
                      WHERE NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=i.farmer_id)),
    'qr_tokens',     (SELECT count(*) FROM qr_tokens q
                      WHERE NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=q.farmer_id)),
    'lands',         (SELECT count(*) FROM lands ld
                      WHERE NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id=ld.farmer_id))
  ) INTO v_orphans;

  -- Savings balance recompute: compare per-farmer sum vs computed
  SELECT count(*) INTO v_savings_mismatch FROM (
    SELECT farmer_id,
      coalesce(sum(case when type='deposit'  and status='approved' then amount end),0) -
      coalesce(sum(case when type='withdraw' and status='approved' then amount end),0) AS computed
    FROM savings_transactions
    GROUP BY farmer_id
    HAVING coalesce(sum(case when type='deposit' and status='approved' then amount end),0) -
           coalesce(sum(case when type='withdraw' and status='approved' then amount end),0) < 0
  ) bad;

  -- Loan balance recompute: outstanding cannot be negative
  SELECT count(*) INTO v_loan_mismatch FROM (
    SELECT l.id,
      l.total_payable - coalesce((SELECT sum(amount) FROM loan_payments lp
                                  WHERE lp.loan_id=l.id AND lp.status='approved'),0) AS outstanding
    FROM loans l
    HAVING l.total_payable - coalesce((SELECT sum(amount) FROM loan_payments lp
                                       WHERE lp.loan_id=l.id AND lp.status='approved'),0) < -0.01
  ) bad;

  -- Ledger: per-reference balance check + global trial balance
  SELECT count(*) INTO v_ledger_unbal_count FROM public.ledger_unbalanced_refs();
  SELECT coalesce(sum(debit) - sum(credit), 0) INTO v_ledger_diff FROM ledger_entries;

  -- QR uniqueness: duplicates active per farmer + farmers without token
  SELECT count(*) INTO v_dup_qr FROM (
    SELECT farmer_id FROM qr_tokens WHERE revoked=false
    GROUP BY farmer_id HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_no_qr FROM farmers f
    WHERE f.status='active'
      AND NOT EXISTS (SELECT 1 FROM qr_tokens q WHERE q.farmer_id=f.id AND q.revoked=false);

  v_status := CASE
    WHEN (v_orphans->>'savings')::int > 0
      OR (v_orphans->>'loans')::int > 0
      OR (v_orphans->>'loan_payments')::int > 0
      OR (v_orphans->>'irrigation')::int > 0
      OR (v_orphans->>'qr_tokens')::int > 0
      OR (v_orphans->>'lands')::int > 0
      OR v_savings_mismatch > 0
      OR v_loan_mismatch > 0
      OR v_ledger_unbal_count > 0
      OR abs(v_ledger_diff) > 0.01
      OR v_dup_qr > 0
      OR v_no_qr > 0
    THEN 'fail' ELSE 'ok' END;

  RETURN jsonb_build_object(
    'status', v_status,
    'checked_at', now(),
    'orphans', v_orphans,
    'savings_negative_balance_farmers', v_savings_mismatch,
    'loan_overpaid_count', v_loan_mismatch,
    'ledger_unbalanced_refs', v_ledger_unbal_count,
    'ledger_global_diff', v_ledger_diff,
    'qr_duplicate_active', v_dup_qr,
    'qr_missing_for_active_farmers', v_no_qr,
    'totals', jsonb_build_object(
      'farmers',       (SELECT count(*) FROM farmers),
      'savings_txns',  (SELECT count(*) FROM savings_transactions),
      'loans',         (SELECT count(*) FROM loans),
      'loan_payments', (SELECT count(*) FROM loan_payments),
      'irrigation',    (SELECT count(*) FROM irrigation_charges),
      'qr_tokens',     (SELECT count(*) FROM qr_tokens WHERE revoked=false),
      'ledger_entries',(SELECT count(*) FROM ledger_entries)
    )
  );
END $$;

-- ============================================================
-- 5. generate_farmer_qr_tokens() — collision-safe issuer
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_farmer_qr_tokens(_force_rotate boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_farmer record;
  v_token text;
  v_attempts int;
  v_issued int := 0;
  v_skipped int := 0;
  v_collisions int := 0;
BEGIN
  IF NOT has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin can generate QR tokens';
  END IF;

  IF _force_rotate THEN
    UPDATE public.qr_tokens SET revoked = true WHERE revoked = false;
  END IF;

  FOR v_farmer IN
    SELECT f.id FROM public.farmers f WHERE f.status='active'
  LOOP
    -- Skip if active token already exists and not forcing rotate
    IF EXISTS (SELECT 1 FROM public.qr_tokens q
               WHERE q.farmer_id=v_farmer.id AND q.revoked=false) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      v_token := encode(gen_random_bytes(24), 'hex');
      BEGIN
        INSERT INTO public.qr_tokens (farmer_id, token, revoked, created_by)
        VALUES (v_farmer.id, v_token, false, v_uid);
        v_issued := v_issued + 1;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_collisions := v_collisions + 1;
        IF v_attempts >= 5 THEN
          RAISE EXCEPTION 'Could not issue unique QR token for farmer % after 5 attempts', v_farmer.id;
        END IF;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'issued', v_issued,
    'skipped_existing', v_skipped,
    'collisions_retried', v_collisions,
    'force_rotate', _force_rotate,
    'completed_at', now()
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_rajshahi_locations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_seed_integrity() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_farmer_qr_tokens(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_rajshahi_locations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_seed_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_farmer_qr_tokens(boolean) TO authenticated;