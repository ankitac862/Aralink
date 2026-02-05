-- Complete SQL Setup for Lease PDF Generation
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================
-- PART 1: Storage Policies for lease-documents bucket
-- ============================================

-- Policy 1: Allow users to upload lease documents
DROP POLICY IF EXISTS "Users can upload lease documents" ON storage.objects;
CREATE POLICY "Users can upload lease documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 2: Allow users to read their own documents
DROP POLICY IF EXISTS "Users can read their lease documents" ON storage.objects;
CREATE POLICY "Users can read their lease documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 3: Allow users to delete their own documents
DROP POLICY IF EXISTS "Users can delete their lease documents" ON storage.objects;
CREATE POLICY "Users can delete their lease documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- ============================================
-- PART 2: Database Tables (if not exist)
-- ============================================

-- Leases table
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  unit_id uuid,
  tenant_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'expired', 'terminated')),
  form_data jsonb NOT NULL,
  effective_date date,
  expiry_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lease documents table
CREATE TABLE IF NOT EXISTS lease_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  storage_key text NOT NULL,
  filename text NOT NULL,
  mime_type text DEFAULT 'application/pdf',
  file_size bigint,
  version integer NOT NULL DEFAULT 1,
  is_current boolean DEFAULT true,
  engine_used text CHECK (engine_used IN ('xfa', 'template', 'standard', 'uploaded')),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Add engine_used column if it doesn't exist (for existing deployments)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_documents' AND column_name = 'engine_used'
  ) THEN
    ALTER TABLE lease_documents 
    ADD COLUMN engine_used text CHECK (engine_used IN ('xfa', 'template', 'standard', 'uploaded'));
  END IF;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PART 3: Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Leases policies
DROP POLICY IF EXISTS "Users can view their own leases" ON leases;
CREATE POLICY "Users can view their own leases"
ON leases FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own leases" ON leases;
CREATE POLICY "Users can create their own leases"
ON leases FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own leases" ON leases;
CREATE POLICY "Users can update their own leases"
ON leases FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own leases" ON leases;
CREATE POLICY "Users can delete their own leases"
ON leases FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Lease documents policies
DROP POLICY IF EXISTS "Users can view their lease documents" ON lease_documents;
CREATE POLICY "Users can view their lease documents"
ON lease_documents FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  lease_id IN (SELECT id FROM leases WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create lease documents" ON lease_documents;
CREATE POLICY "Users can create lease documents"
ON lease_documents FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their lease documents" ON lease_documents;
CREATE POLICY "Users can update their lease documents"
ON lease_documents FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their lease documents" ON lease_documents;
CREATE POLICY "Users can delete their lease documents"
ON lease_documents FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- PART 4: Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leases_user_id ON leases(user_id);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
CREATE INDEX IF NOT EXISTS idx_lease_documents_lease_id ON lease_documents(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_documents_is_current ON lease_documents(is_current);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================
-- PART 5: Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for leases table
DROP TRIGGER IF EXISTS update_leases_updated_at ON leases;
CREATE TRIGGER update_leases_updated_at
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify storage policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%lease%'
ORDER BY policyname;

-- Verify database tables
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('leases', 'lease_documents', 'notifications');

-- Verify RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('leases', 'lease_documents', 'notifications');

-- Verify database policies
SELECT 
  schemaname, 
  tablename, 
  policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('leases', 'lease_documents', 'notifications')
ORDER BY tablename, policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Lease PDF Generation setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Deploy Edge Function: supabase functions deploy generate-lease-pdf';
  RAISE NOTICE '2. Test lease generation in your app';
  RAISE NOTICE '3. Check the generated PDF contains all 17 sections';
END $$;
