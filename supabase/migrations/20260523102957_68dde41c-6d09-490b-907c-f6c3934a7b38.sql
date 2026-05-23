
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view templates" ON public.sms_templates;
CREATE POLICY "Authenticated can view templates" ON public.sms_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage templates" ON public.sms_templates;
CREATE POLICY "Admins can manage templates" ON public.sms_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_sms_templates_updated ON public.sms_templates;
CREATE TRIGGER trg_sms_templates_updated
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sms_templates (key, name, body, variables) VALUES
  ('payment_receipt', 'Payment Receipt', 'প্রিয় {name}, আপনার {type} বাবদ ৳{amount} গ্রহণ করা হয়েছে। রসিদ: {receipt}। ধন্যবাদ - MK Balia Danga', ARRAY['name','type','amount','receipt']),
  ('loan_due_reminder', 'Loan Due Reminder', 'প্রিয় {name}, আপনার ঋণের কিস্তি ৳{amount} {date} তারিখে পরিশোধ্য। দয়া করে সময়মতো পরিশোধ করুন - MK Balia Danga', ARRAY['name','amount','date']),
  ('irrigation_due', 'Irrigation Due', 'প্রিয় {name}, সেচ বিল ৳{amount} বকেয়া। দ্রুত পরিশোধ করুন - MK Balia Danga', ARRAY['name','amount'])
ON CONFLICT (key) DO NOTHING;
