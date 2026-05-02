CREATE TABLE IF NOT EXISTS public.receipt_settings (
  id integer PRIMARY KEY DEFAULT 1,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','bn','both')),
  paper_size text NOT NULL DEFAULT 'a5' CHECK (paper_size IN ('a4','a5','a6')),
  accent_color text NOT NULL DEFAULT '#1f4e79',
  show_logo boolean NOT NULL DEFAULT true,
  show_signature_line boolean NOT NULL DEFAULT true,
  show_office boolean NOT NULL DEFAULT true,
  show_token_block boolean NOT NULL DEFAULT true,
  header_alignment text NOT NULL DEFAULT 'center' CHECK (header_alignment IN ('left','center','right')),
  footer_note text NOT NULL DEFAULT 'This is a system-generated receipt. Please retain for your records.',
  footer_note_bn text NOT NULL DEFAULT 'এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT receipt_settings_singleton CHECK (id = 1)
);

INSERT INTO public.receipt_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read receipt_settings"
  ON public.receipt_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "super admin manage receipt_settings"
  ON public.receipt_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));