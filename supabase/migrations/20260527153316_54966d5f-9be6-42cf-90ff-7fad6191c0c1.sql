
CREATE TABLE IF NOT EXISTS public.land_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_land_id uuid NOT NULL REFERENCES public.lands(id) ON DELETE RESTRICT,
  source_farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT,
  transfer_type text NOT NULL CHECK (transfer_type IN ('inheritance','sale','borga_transfer','split','other')),
  remark text,
  office_id uuid,
  transferred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.land_transfer_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.land_transfers(id) ON DELETE CASCADE,
  recipient_farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE RESTRICT,
  new_land_id uuid REFERENCES public.lands(id) ON DELETE SET NULL,
  area_decimal numeric(12,3) NOT NULL CHECK (area_decimal > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_land_transfers_source_land ON public.land_transfers(source_land_id);
CREATE INDEX IF NOT EXISTS idx_land_transfers_source_farmer ON public.land_transfers(source_farmer_id);
CREATE INDEX IF NOT EXISTS idx_land_transfers_office ON public.land_transfers(office_id);
CREATE INDEX IF NOT EXISTS idx_ltr_transfer ON public.land_transfer_recipients(transfer_id);
CREATE INDEX IF NOT EXISTS idx_ltr_recipient ON public.land_transfer_recipients(recipient_farmer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_transfers TO authenticated;
GRANT ALL ON public.land_transfers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_transfer_recipients TO authenticated;
GRANT ALL ON public.land_transfer_recipients TO service_role;

ALTER TABLE public.land_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_transfer_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office read land transfers" ON public.land_transfers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "office write land transfers" ON public.land_transfers
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office() OR office_id IS NULL);
CREATE POLICY "office update land transfers" ON public.land_transfers
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role) OR office_id = current_user_office());
CREATE POLICY "super delete land transfers" ON public.land_transfers
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "office read land transfer recipients" ON public.land_transfer_recipients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.land_transfers t WHERE t.id = transfer_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR t.office_id = current_user_office() OR t.office_id IS NULL)));
CREATE POLICY "office write land transfer recipients" ON public.land_transfer_recipients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.land_transfers t WHERE t.id = transfer_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR t.office_id = current_user_office() OR t.office_id IS NULL)));
CREATE POLICY "office update land transfer recipients" ON public.land_transfer_recipients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.land_transfers t WHERE t.id = transfer_id AND (has_role(auth.uid(), 'super_admin'::app_role) OR t.office_id = current_user_office())));
CREATE POLICY "super delete land transfer recipients" ON public.land_transfer_recipients
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
