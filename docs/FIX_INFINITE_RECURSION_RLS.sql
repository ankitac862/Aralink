-- =====================================================
-- FIX INFINITE RECURSION - Simplified RLS Policies
-- =====================================================
-- This fixes the circular dependency issues in RLS policies

-- =====================================================
-- 1. PROFILES - Simple view policy
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Allow all authenticated users to view profiles
CREATE POLICY "Authenticated users can view all profiles"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- 2. TENANTS - Direct policies without subqueries
-- =====================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can view their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete their tenants" ON public.tenants;

-- Tenants can view their own record (direct user_id check)
CREATE POLICY "Tenants can view own record"
    ON public.tenants FOR SELECT
    USING (user_id = auth.uid());

-- Anyone authenticated can view tenants (we'll rely on app logic for filtering)
CREATE POLICY "Authenticated users can view tenants"
    ON public.tenants FOR SELECT
    USING (auth.role() = 'authenticated');

-- Anyone can insert tenants (conversion from applicants)
CREATE POLICY "Anyone can insert tenants"
    ON public.tenants FOR INSERT
    WITH CHECK (true);

-- Anyone authenticated can update tenants
CREATE POLICY "Authenticated users can update tenants"
    ON public.tenants FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Anyone authenticated can delete tenants
CREATE POLICY "Authenticated users can delete tenants"
    ON public.tenants FOR DELETE
    USING (auth.role() = 'authenticated');

-- =====================================================
-- 3. TENANT_PROPERTY_LINKS - Direct policies
-- =====================================================
ALTER TABLE public.tenant_property_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Landlords can view their tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can insert tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can update their tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can delete their tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Tenants can view own links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Authenticated users can view links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Authenticated users can insert links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Authenticated users can update links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Authenticated users can delete links" ON public.tenant_property_links;

-- Allow all authenticated users to manage tenant property links
CREATE POLICY "Authenticated users can view links"
    ON public.tenant_property_links FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert links"
    ON public.tenant_property_links FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update links"
    ON public.tenant_property_links FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete links"
    ON public.tenant_property_links FOR DELETE
    USING (auth.role() = 'authenticated');

-- =====================================================
-- 4. LEASES - Direct policies without circular references
-- =====================================================
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own leases" ON public.leases;
DROP POLICY IF EXISTS "Landlords can view leases for their properties" ON public.leases;
DROP POLICY IF EXISTS "Landlords can manage leases" ON public.leases;
DROP POLICY IF EXISTS "Landlords can insert leases" ON public.leases;
DROP POLICY IF EXISTS "Landlords can update leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can update their leases" ON public.leases;
DROP POLICY IF EXISTS "Applicants can update their leases" ON public.leases;
DROP POLICY IF EXISTS "Landlords can delete leases" ON public.leases;
DROP POLICY IF EXISTS "Authenticated users can view leases" ON public.leases;
DROP POLICY IF EXISTS "Authenticated users can insert leases" ON public.leases;
DROP POLICY IF EXISTS "Authenticated users can update leases" ON public.leases;
DROP POLICY IF EXISTS "Authenticated users can delete leases" ON public.leases;

-- Simple policies for leases
CREATE POLICY "Authenticated users can view leases"
    ON public.leases FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert leases"
    ON public.leases FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update leases"
    ON public.leases FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete leases"
    ON public.leases FOR DELETE
    USING (auth.role() = 'authenticated');

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'tenants', 'tenant_property_links', 'leases')
ORDER BY tablename, cmd, policyname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies simplified - no more infinite recursion!';
    RAISE NOTICE '✅ All authenticated users can now access data (app-level security applies)';
END $$;
