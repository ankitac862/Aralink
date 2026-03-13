-- Fix RLS policies for leases to allow applicants to view their leases
-- This allows tenants to view leases associated with their applications

-- Drop ALL existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own leases" ON leases;
DROP POLICY IF EXISTS "Landlords can view their leases" ON leases;
DROP POLICY IF EXISTS "Tenants can view leases" ON leases;
DROP POLICY IF EXISTS "Tenants can view their direct leases" ON leases;
DROP POLICY IF EXISTS "Applicants can view their application leases" ON leases;
DROP POLICY IF EXISTS "Landlords can view their property leases" ON leases;
DROP POLICY IF EXISTS "Landlords can create leases" ON leases;
DROP POLICY IF EXISTS "Landlords can update their leases" ON leases;
DROP POLICY IF EXISTS "Tenants can update their assigned leases" ON leases;
DROP POLICY IF EXISTS "Applicants can update their application leases" ON leases;
DROP POLICY IF EXISTS "Landlords can delete their leases" ON leases;
DROP POLICY IF EXISTS "Users can insert their own leases" ON leases;
DROP POLICY IF EXISTS "Users can update their own leases" ON leases;
DROP POLICY IF EXISTS "Users can delete their own leases" ON leases;
DROP POLICY IF EXISTS "Tenants can view their assigned leases" ON leases;

-- Allow users to view leases where they are the tenant
CREATE POLICY "Tenants can view their direct leases"
ON leases FOR SELECT
USING (
  auth.uid() = tenant_id
);

-- Allow users to view leases associated with their applications
CREATE POLICY "Applicants can view their application leases"
ON leases FOR SELECT
USING (
  application_id IN (
    SELECT id FROM applications
    WHERE user_id = auth.uid()
  )
);

-- Allow landlords to view all their property leases
CREATE POLICY "Landlords can view their property leases"
ON leases FOR SELECT
USING (
  user_id = auth.uid()
);

-- Allow landlords to insert leases for their properties
CREATE POLICY "Landlords can create leases"
ON leases FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- Allow landlords to update their leases
CREATE POLICY "Landlords can update their leases"
ON leases FOR UPDATE
USING (
  user_id = auth.uid()
);

-- Allow tenants to update their own leases (for signing, etc.)
CREATE POLICY "Tenants can update their assigned leases"
ON leases FOR UPDATE
USING (
  tenant_id = auth.uid()
);

-- Allow applicants to update leases associated with their applications
CREATE POLICY "Applicants can update their application leases"
ON leases FOR UPDATE
USING (
  -- Check if lease's application email matches current user's email
  application_id IN (
    SELECT a.id FROM applications a
    INNER JOIN profiles p ON p.email = a.applicant_email
    WHERE p.id = auth.uid()
  )
);

-- Allow landlords to delete their leases
CREATE POLICY "Landlords can delete their leases"
ON leases FOR DELETE
USING (
  user_id = auth.uid()
);

-- Check the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'leases'
ORDER BY policyname;
