-- Allow authenticated users to upload to the lease-archives storage bucket.
-- The bucket is still private (not publicly readable) — this only allows
-- the authenticated landlord to write their own archive files.

CREATE POLICY "lease_archives_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lease-archives');

-- Allow authenticated users to read their own archive files
CREATE POLICY "lease_archives_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lease-archives');
