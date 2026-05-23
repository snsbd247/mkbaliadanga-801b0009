CREATE TABLE IF NOT EXISTS public.farmer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  note text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farmer_notes_farmer ON public.farmer_notes(farmer_id);

ALTER TABLE public.farmer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmer_notes_read" ON public.farmer_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "farmer_notes_insert" ON public.farmer_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "farmer_notes_update" ON public.farmer_notes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_committee_or_super(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_committee_or_super(auth.uid()));
CREATE POLICY "farmer_notes_delete" ON public.farmer_notes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_committee_or_super(auth.uid()));

CREATE TRIGGER trg_farmer_notes_set_updated_at
  BEFORE UPDATE ON public.farmer_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS idx_sav_category ON public.savings_transactions(category) WHERE category IS NOT NULL;