
-- Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS farmers_account_number_idx ON public.farmers (account_number);
CREATE INDEX IF NOT EXISTS farmers_voter_number_idx ON public.farmers (voter_number) WHERE voter_number IS NOT NULL AND voter_number <> '';

-- Voter number generator
CREATE OR REPLACE FUNCTION public.generate_farmer_voter_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  i int := 0;
BEGIN
  LOOP
    candidate := lpad((floor(random() * 9000000)::int + 1000000)::text, 7, '0');
    PERFORM 1 FROM public.farmers WHERE voter_number = candidate;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    i := i + 1;
    IF i > 25 THEN
      RAISE EXCEPTION 'Could not generate unique voter_number';
    END IF;
  END LOOP;
END;
$$;

-- Card designer settings (singleton id=1)
CREATE TABLE IF NOT EXISTS public.card_settings (
  id integer PRIMARY KEY DEFAULT 1,
  template_id text NOT NULL DEFAULT 'classic',
  accent_color text NOT NULL DEFAULT '#107a57',
  header_text text NOT NULL DEFAULT '',
  header_text_bn text NOT NULL DEFAULT '',
  show_photo boolean NOT NULL DEFAULT true,
  show_account_number boolean NOT NULL DEFAULT true,
  show_voter_number boolean NOT NULL DEFAULT true,
  show_issue_date boolean NOT NULL DEFAULT true,
  show_qr boolean NOT NULL DEFAULT true,
  photo_size_mm numeric NOT NULL DEFAULT 18,
  font_scale numeric NOT NULL DEFAULT 1.0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT card_settings_singleton CHECK (id = 1)
);

INSERT INTO public.card_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.card_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read card_settings" ON public.card_settings;
CREATE POLICY "auth read card_settings" ON public.card_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super manage card_settings" ON public.card_settings;
CREATE POLICY "super manage card_settings" ON public.card_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
