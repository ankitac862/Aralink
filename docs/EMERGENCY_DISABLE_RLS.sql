-- =====================================================
-- EMERGENCY FIX: Disable RLS temporarily to unblock app
-- =====================================================
-- This temporarily disables RLS to fix the infinite recursion
-- Run this ONLY if your app is completely stuck

-- Option 1: Completely disable RLS on leases (TEMPORARY - not secure)
ALTER TABLE public.leases DISABLE ROW LEVEL SECURITY;

-- Option 2: Keep RLS enabled but remove all policies and add simple one
-- (Uncomment these if you prefer to keep RLS enabled)
/*
DROP POLICY IF EXISTS "Authenticated users can view leases" ON public.leases;
DROP POLICY IF EXISTS "Authenticated users can insert leases" ON public.leases;
DROP POLICY IF EXISTS "Authenticated users can update leases" ON public.leases;  
DROP POLICY IF EXISTS "Authenticated users can delete leases" ON public.leases;

-- Simple policy: all authenticated users can do everything
CREATE POLICY "Allow all for authenticated users"
    ON public.leases
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
*/

-- Verify RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('leases', 'tenants', 'tenant_property_links', 'applications');

-- Check remaining policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'leases';
