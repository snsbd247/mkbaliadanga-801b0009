-- Generate installment schedule for a loan based on its loan_plan
CREATE OR REPLACE FUNCTION public.generate_loan_installments(_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_plan public.loan_plans%ROWTYPE;
  v_count int;
  v_paid_existing int;
  v_per numeric;
  v_total numeric;
  v_due_date date;
  i int;
BEGIN
  IF NOT is_committee_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only committee or super admin can generate schedules';
  END IF;

  SELECT * INTO v_loan FROM public.loans WHERE id = _loan_id;
  IF v_loan.id IS NULL THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.plan_id IS NULL THEN RAISE EXCEPTION 'Loan has no plan_id attached'; END IF;

  SELECT * INTO v_plan FROM public.loan_plans WHERE id = v_loan.plan_id;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Loan plan not found'; END IF;

  -- Don't blow away schedule once payments started
  SELECT count(*) INTO v_paid_existing
  FROM public.loan_installments
  WHERE loan_id = _loan_id AND paid_amount > 0;
  IF v_paid_existing > 0 THEN
    RAISE EXCEPTION 'Cannot regenerate: % installment(s) already have payments', v_paid_existing;
  END IF;

  DELETE FROM public.loan_installments WHERE loan_id = _loan_id;

  -- Count of installments based on installment_type and duration_months
  v_count := CASE v_plan.installment_type
    WHEN 'daily'   THEN v_plan.duration_months * 30
    WHEN 'weekly'  THEN GREATEST(1, (v_plan.duration_months * 30) / 7)
    WHEN 'monthly' THEN v_plan.duration_months
  END;

  v_total := COALESCE(v_loan.total_payable, v_loan.principal);
  v_per := round(v_total / v_count, 2);

  FOR i IN 1..v_count LOOP
    v_due_date := CASE v_plan.installment_type
      WHEN 'daily'   THEN v_loan.issued_on + (i || ' days')::interval
      WHEN 'weekly'  THEN v_loan.issued_on + (i * 7 || ' days')::interval
      WHEN 'monthly' THEN v_loan.issued_on + (i || ' months')::interval
    END;

    INSERT INTO public.loan_installments(
      loan_id, installment_no, due_date, amount, status, office_id
    ) VALUES (
      _loan_id, i, v_due_date::date,
      CASE WHEN i = v_count THEN v_total - (v_per * (v_count - 1)) ELSE v_per END,
      'due', v_loan.office_id
    );
  END LOOP;

  -- Update loans summary fields (additive columns)
  UPDATE public.loans
     SET installment_amount = v_per,
         total_due = v_total,
         next_due_on = (SELECT MIN(due_date) FROM public.loan_installments WHERE loan_id = _loan_id)
   WHERE id = _loan_id;

  RETURN jsonb_build_object(
    'loan_id', _loan_id,
    'installments', v_count,
    'per_installment', v_per,
    'total', v_total
  );
END $$;

-- Daily job: mark missed + apply penalty for each overdue installment per loan plan rules
CREATE OR REPLACE FUNCTION public.apply_loan_installment_penalties()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_pen numeric;
  v_marked int := 0;
  v_penalized int := 0;
BEGIN
  IF NOT is_committee_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only committee or super admin can run penalty job';
  END IF;

  FOR r IN
    SELECT li.id, li.loan_id, li.amount, li.paid_amount, li.due_date, li.status,
           lp.penalty_type, lp.penalty_value, lp.grace_period_days
    FROM public.loan_installments li
    JOIN public.loans l ON l.id = li.loan_id
    LEFT JOIN public.loan_plans lp ON lp.id = l.plan_id
    WHERE li.status IN ('due','partial')
      AND li.due_date < CURRENT_DATE
      AND COALESCE(li.paid_amount,0) < li.amount
  LOOP
    -- Mark missed only after grace period
    IF (CURRENT_DATE - r.due_date) > COALESCE(r.grace_period_days, 0) THEN
      v_pen := 0;
      IF r.penalty_type = 'percentage' THEN
        v_pen := round((r.amount * COALESCE(r.penalty_value,0) / 100.0)::numeric, 2);
      ELSIF r.penalty_type = 'fixed' THEN
        v_pen := COALESCE(r.penalty_value, 0);
      END IF;

      UPDATE public.loan_installments
         SET status = 'missed',
             penalty_amount = GREATEST(penalty_amount, v_pen)
       WHERE id = r.id;
      v_marked := v_marked + 1;
      IF v_pen > 0 THEN v_penalized := v_penalized + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'marked_missed', v_marked,
    'penalized', v_penalized,
    'ran_at', now()
  );
END $$;
