CREATE POLICY land_note_files_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'land-note-attachments');

CREATE POLICY land_note_files_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'land-note-attachments');

CREATE POLICY land_note_files_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'land-note-attachments');