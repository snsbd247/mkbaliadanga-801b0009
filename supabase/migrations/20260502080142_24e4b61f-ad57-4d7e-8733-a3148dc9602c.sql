-- Enable pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============ SMS Settings ============
CREATE TABLE IF NOT EXISTS public.sms_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  sender_id text,
  api_key_set boolean NOT NULL DEFAULT false,
  send_on_savings_deposit boolean NOT NULL DEFAULT true,
  send_on_savings_withdraw boolean NOT NULL DEFAULT true,
  send_on_loan_approved boolean NOT NULL DEFAULT true,
  send_on_loan_payment boolean NOT NULL DEFAULT true,
  send_on_irrigation_payment boolean NOT NULL DEFAULT true,
  send_on_due_reminder boolean NOT NULL DEFAULT true,
  tpl_savings_deposit text NOT NULL DEFAULT 'আপনার হিসাবে {amount} টাকা জমা হয়েছে। বর্তমান ব্যালেন্স: {balance} টাকা।',
  tpl_savings_withdraw text NOT NULL DEFAULT 'আপনার হিসাব থেকে {amount} টাকা উত্তোলন হয়েছে। বর্তমান ব্যালেন্স: {balance} টাকা।',
  tpl_loan_approved text NOT NULL DEFAULT 'আপনার ঋণ {amount} টাকা অনুমোদিত হয়েছে। মোট পরিশোধযোগ্য: {payable} টাকা।',
  tpl_loan_payment text NOT NULL DEFAULT 'আপনার ঋণের {amount} টাকা পরিশোধ হয়েছে। বকেয়া: {due} টাকা।',
  tpl_irrigation_payment text NOT NULL DEFAULT 'সেচ বাবদ {amount} টাকা গ্রহণ করা হয়েছে। ধন্যবাদ।',
  tpl_due_reminder text NOT NULL DEFAULT 'আপনার {type} বাবদ {due} টাকা বকেয়া আছে। দ্রুত পরিশোধ করুন।',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sms_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin manage sms_settings" ON public.sms_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "auth read sms_settings" ON public.sms_settings
  FOR SELECT TO authenticated USING (true);

-- ============ SMS Logs ============
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued', -- queued | sent | failed
  provider_response text,
  event_type text, -- savings_deposit, savings_withdraw, loan_approved, loan_payment, irrigation_payment, due_reminder, bulk, manual
  farmer_id uuid,
  reference_type text,
  reference_id uuid,
  office_id uuid,
  retry_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_farmer ON public.sms_logs(farmer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON public.sms_logs(created_at DESC);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read sms_logs" ON public.sms_logs
  FOR SELECT TO authenticated
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "admin insert sms_logs" ON public.sms_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "admin update sms_logs" ON public.sms_logs
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "super admin delete sms_logs" ON public.sms_logs
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public._sms_format_bdt(_n numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(coalesce(_n,0), 'FM999,999,999,990.00');
$$;

CREATE OR REPLACE FUNCTION public._sms_savings_balance(_farmer uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(case when type='deposit' and status='approved' then amount end),0)
       - coalesce(sum(case when type='withdraw' and status='approved' then amount end),0)
  FROM public.savings_transactions WHERE farmer_id = _farmer;
$$;

-- Render template with replacements
CREATE OR REPLACE FUNCTION public._sms_render(_tpl text, _vars jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  k text; v text; out text := _tpl;
BEGIN
  IF _vars IS NULL THEN RETURN _tpl; END IF;
  FOR k, v IN SELECT key, value::text FROM jsonb_each_text(_vars) LOOP
    out := replace(out, '{' || k || '}', coalesce(v, ''));
  END LOOP;
  RETURN out;
END $$;

-- Enqueue SMS: insert log + fire pg_net call to edge function (best-effort)
CREATE OR REPLACE FUNCTION public.sms_enqueue(
  _mobile text,
  _message text,
  _event text,
  _farmer uuid,
  _ref_type text,
  _ref_id uuid,
  _office uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_settings public.sms_settings%ROWTYPE;
  v_url text;
  v_anon text;
BEGIN
  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled THEN RETURN NULL; END IF;
  IF _mobile IS NULL OR length(trim(_mobile)) < 6 THEN RETURN NULL; END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.sms_logs(mobile, message, status, event_type, farmer_id, reference_type, reference_id, office_id, created_by)
  VALUES (trim(_mobile), _message, 'queued', _event, _farmer, _ref_type, _ref_id, _office, auth.uid())
  RETURNING id INTO v_id;

  -- Fire-and-forget HTTP to send-sms edge function.
  -- Runtime values are injected per environment; never fall back to a fixed cloud project.
  v_url := nullif(current_setting('app.supabase_url', true), '');
  v_anon := nullif(current_setting('app.supabase_anon_key', true), '');

  IF v_url IS NULL OR v_anon IS NULL THEN
    RETURN v_id;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-sms',
      headers := jsonb_build_object('Content-Type','application/json','apikey',v_anon,'Authorization','Bearer '||v_anon),
      body := jsonb_build_object('log_id', v_id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Leave as queued; retry endpoint can flush later
    NULL;
  END;
  RETURN v_id;
END $$;

-- ============ Event triggers ============
CREATE OR REPLACE FUNCTION public.trg_sms_savings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.sms_settings%ROWTYPE;
  v_mobile text; v_balance numeric; v_msg text; v_tpl text;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  -- only fire when transitioning to approved or new approved
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled THEN RETURN NEW; END IF;

  SELECT mobile INTO v_mobile FROM public.farmers WHERE id = NEW.farmer_id;
  IF v_mobile IS NULL THEN RETURN NEW; END IF;

  v_balance := public._sms_savings_balance(NEW.farmer_id);

  IF NEW.type = 'deposit' AND v_settings.send_on_savings_deposit THEN
    v_tpl := v_settings.tpl_savings_deposit;
    v_msg := public._sms_render(v_tpl, jsonb_build_object(
      'amount', public._sms_format_bdt(NEW.amount),
      'balance', public._sms_format_bdt(v_balance)
    ));
    PERFORM public.sms_enqueue(v_mobile, v_msg, 'savings_deposit', NEW.farmer_id, 'savings', NEW.id, NEW.office_id);
  ELSIF NEW.type = 'withdraw' AND v_settings.send_on_savings_withdraw THEN
    v_tpl := v_settings.tpl_savings_withdraw;
    v_msg := public._sms_render(v_tpl, jsonb_build_object(
      'amount', public._sms_format_bdt(NEW.amount),
      'balance', public._sms_format_bdt(v_balance)
    ));
    PERFORM public.sms_enqueue(v_mobile, v_msg, 'savings_withdraw', NEW.farmer_id, 'savings', NEW.id, NEW.office_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sms_after_savings ON public.savings_transactions;
CREATE TRIGGER sms_after_savings
AFTER INSERT OR UPDATE ON public.savings_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_sms_savings();

CREATE OR REPLACE FUNCTION public.trg_sms_loan_approved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.sms_settings%ROWTYPE;
  v_mobile text; v_msg text;
BEGIN
  IF NEW.status NOT IN ('approved','paid') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('approved','paid') THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled OR NOT v_settings.send_on_loan_approved THEN RETURN NEW; END IF;

  SELECT mobile INTO v_mobile FROM public.farmers WHERE id = NEW.farmer_id;
  IF v_mobile IS NULL THEN RETURN NEW; END IF;

  v_msg := public._sms_render(v_settings.tpl_loan_approved, jsonb_build_object(
    'amount', public._sms_format_bdt(NEW.principal),
    'payable', public._sms_format_bdt(NEW.total_payable)
  ));
  PERFORM public.sms_enqueue(v_mobile, v_msg, 'loan_approved', NEW.farmer_id, 'loan', NEW.id, NEW.office_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sms_after_loan ON public.loans;
CREATE TRIGGER sms_after_loan
AFTER INSERT OR UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.trg_sms_loan_approved();

CREATE OR REPLACE FUNCTION public.trg_sms_loan_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.sms_settings%ROWTYPE;
  v_mobile text; v_msg text; v_due numeric; v_payable numeric; v_paid numeric; v_farmer uuid; v_office uuid;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled OR NOT v_settings.send_on_loan_payment THEN RETURN NEW; END IF;

  SELECT farmer_id, total_payable, office_id INTO v_farmer, v_payable, v_office FROM public.loans WHERE id = NEW.loan_id;
  IF v_farmer IS NULL THEN RETURN NEW; END IF;
  SELECT mobile INTO v_mobile FROM public.farmers WHERE id = v_farmer;
  IF v_mobile IS NULL THEN RETURN NEW; END IF;

  SELECT coalesce(sum(amount),0) INTO v_paid FROM public.loan_payments WHERE loan_id = NEW.loan_id AND status = 'approved';
  v_due := greatest(coalesce(v_payable,0) - coalesce(v_paid,0), 0);

  v_msg := public._sms_render(v_settings.tpl_loan_payment, jsonb_build_object(
    'amount', public._sms_format_bdt(NEW.amount),
    'due', public._sms_format_bdt(v_due)
  ));
  PERFORM public.sms_enqueue(v_mobile, v_msg, 'loan_payment', v_farmer, 'loan_payment', NEW.id, coalesce(NEW.office_id, v_office));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sms_after_loan_payment ON public.loan_payments;
CREATE TRIGGER sms_after_loan_payment
AFTER INSERT OR UPDATE ON public.loan_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_sms_loan_payment();

CREATE OR REPLACE FUNCTION public.trg_sms_irrigation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.sms_settings%ROWTYPE;
  v_mobile text; v_msg text;
BEGIN
  IF coalesce(NEW.paid_amount,0) <= 0 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.paid_amount,0) = coalesce(NEW.paid_amount,0) THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.sms_settings WHERE id = 1;
  IF v_settings IS NULL OR NOT v_settings.enabled OR NOT v_settings.send_on_irrigation_payment THEN RETURN NEW; END IF;

  SELECT mobile INTO v_mobile FROM public.farmers WHERE id = NEW.farmer_id;
  IF v_mobile IS NULL THEN RETURN NEW; END IF;

  v_msg := public._sms_render(v_settings.tpl_irrigation_payment, jsonb_build_object(
    'amount', public._sms_format_bdt(NEW.paid_amount)
  ));
  PERFORM public.sms_enqueue(v_mobile, v_msg, 'irrigation_payment', NEW.farmer_id, 'irrigation', NEW.id, NEW.office_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sms_after_irrigation ON public.irrigation_charges;
CREATE TRIGGER sms_after_irrigation
AFTER INSERT OR UPDATE ON public.irrigation_charges
FOR EACH ROW EXECUTE FUNCTION public.trg_sms_irrigation();

-- Touch updated_at on sms_settings
DROP TRIGGER IF EXISTS sms_settings_touch ON public.sms_settings;
CREATE TRIGGER sms_settings_touch BEFORE UPDATE ON public.sms_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();