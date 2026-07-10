CREATE POLICY "Developers read db backups"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'db-backups' AND public.has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Developers delete db backups"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'db-backups' AND public.has_role(auth.uid(), 'developer'::app_role));