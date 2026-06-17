CREATE TABLE public.irrigation_cashbook_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  office_filter text NOT NULL DEFAULT 'all',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.irrigation_cashbook_presets TO authenticated;
GRANT ALL ON public.irrigation_cashbook_presets TO service_role;

ALTER TABLE public.irrigation_cashbook_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own irrigation cashbook presets"
ON public.irrigation_cashbook_presets
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_irrigation_cashbook_presets_updated_at
BEFORE UPDATE ON public.irrigation_cashbook_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();