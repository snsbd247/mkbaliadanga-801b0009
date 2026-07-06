-- Public buckets serve files by direct path without an RLS SELECT policy.
-- Removing the broad SELECT policy stops clients from listing all files.
DROP POLICY IF EXISTS "branding read by name" ON storage.objects;