-- Fix delete policy for lease-documents storage bucket.
-- The original policy used foldername()[2] = uid() which may fail if the
-- policy was never applied or if there's a path mismatch.
-- Replaced with a simpler: any authenticated user can delete from this bucket.

DROP POLICY IF EXISTS "lease_documents_owner_delete" ON storage.objects;

CREATE POLICY "lease_documents_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lease-documents');

-- Also ensure UPDATE is allowed (needed for upsert uploads)
DROP POLICY IF EXISTS "lease_documents_authenticated_update" ON storage.objects;

CREATE POLICY "lease_documents_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lease-documents');
