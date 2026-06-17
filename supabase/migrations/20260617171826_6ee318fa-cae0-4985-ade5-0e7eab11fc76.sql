-- Audit trail for land note changes
CREATE TABLE public.land_note_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  land_id uuid NOT NULL REFERENCES public.lands(id) ON DELETE CASCADE,
  office_id uuid,
  old_note text,
  new_note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.land_note_audit TO authenticated;
GRANT ALL ON public.land_note_audit TO service_role;
ALTER TABLE public.land_note_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY land_note_audit_read ON public.land_note_audit FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR (EXISTS (
  SELECT 1 FROM public.lands l WHERE l.id = land_note_audit.land_id AND l.office_id = current_user_office()
)));

CREATE POLICY land_note_audit_insert ON public.land_note_audit FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.lands l WHERE l.id = land_note_audit.land_id
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR l.office_id = current_user_office())
));

-- Attachments for land notes
CREATE TABLE public.land_note_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  land_id uuid NOT NULL REFERENCES public.lands(id) ON DELETE CASCADE,
  office_id uuid,
  file_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.land_note_attachments TO authenticated;
GRANT ALL ON public.land_note_attachments TO service_role;
ALTER TABLE public.land_note_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY land_note_att_read ON public.land_note_attachments FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR (EXISTS (
  SELECT 1 FROM public.lands l WHERE l.id = land_note_attachments.land_id AND l.office_id = current_user_office()
)));

CREATE POLICY land_note_att_insert ON public.land_note_attachments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.lands l WHERE l.id = land_note_attachments.land_id
    AND (has_role(auth.uid(), 'super_admin'::app_role) OR l.office_id = current_user_office())
));

CREATE POLICY land_note_att_delete ON public.land_note_attachments FOR DELETE
USING (created_by = auth.uid() OR is_committee_or_super(auth.uid()));