-- =====================================================
-- RUN ALL RLS FIXES - Complete Setup Script
-- =====================================================
-- Run this entire script in Supabase SQL Editor to fix all RLS policies at once
-- This will enable the applicant-to-tenant conversion flow

-- =====================================================
-- 1. FIX PROFILES RLS (Allow viewing other users' profiles)
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- 2. FIX TENANTS TABLE RLS (Allow creating tenants)
-- =====================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can view their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete their tenants" ON public.tenants;

CREATE POLICY "Tenants can view own record"
    ON public.tenants FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Landlords can view their tenants"
    ON public.tenants FOR SELECT
    USING (
        id IN (
            SELECT tpl.tenant_id 
            FROM public.tenant_property_links tpl
            INNER JOIN public.properties p ON p.id = tpl.property_id
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can insert tenants"
    ON public.tenants FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Landlords can update their tenants"
    ON public.tenants FOR UPDATE
    USING (
        id IN (
            SELECT tpl.tenant_id 
            FROM public.tenant_property_links tpl
            INNER JOIN public.properties p ON p.id = tpl.property_id
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can delete their tenants"
    ON public.tenants FOR DELETE
    USING (
        id IN (
            SELECT tpl.tenant_id 
            FROM public.tenant_property_links tpl
            INNER JOIN public.properties p ON p.id = tpl.property_id
            WHERE p.user_id = auth.uid()
        )
    );

-- =====================================================
-- 3. FIX TENANT_PROPERTY_LINKS RLS (Allow creating links)
-- =====================================================
ALTER TABLE public.tenant_property_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Landlords can view their tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can insert tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can update their tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can delete their tenant links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Tenants can view own links" ON public.tenant_property_links;

CREATE POLICY "Landlords can view their tenant links"
    ON public.tenant_property_links FOR SELECT
    USING (
        property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
    );

CREATE POLICY "Landlords can insert tenant links"
    ON public.tenant_property_links FOR INSERT
    WITH CHECK (
        property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
        OR created_by_user_id = auth.uid()
    );

CREATE POLICY "Landlords can update their tenant links"
    ON public.tenant_property_links FOR UPDATE
    USING (
        property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
    );

CREATE POLICY "Landlords can delete their tenant links"
    ON public.tenant_property_links FOR DELETE
    USING (
        property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
    );

CREATE POLICY "Tenants can view own links"
    ON public.tenant_property_links FOR SELECT
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()));

-- =====================================================
-- 4. FIX LEASE RLS (Allow applicants to update leases)
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

-- SELECT policies
CREATE POLICY "Users can view own leases"
    ON public.leases FOR SELECT
    USING (user_id = auth.uid() OR tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()));

CREATE POLICY "Landlords can view leases for their properties"
    ON public.leases FOR SELECT
    USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

-- INSERT policy
CREATE POLICY "Landlords can insert leases"
    ON public.leases FOR INSERT
    WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

-- UPDATE policies (separate for landlords, tenants, and applicants)
CREATE POLICY "Landlords can update leases"
    ON public.leases FOR UPDATE
    USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can update their leases"
    ON public.leases FOR UPDATE
    USING (tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()));

CREATE POLICY "Applicants can update their leases"
    ON public.leases FOR UPDATE
    USING (
        application_id IN (
            SELECT id FROM public.applications 
            WHERE applicant_email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
        )
    );

-- DELETE policy
CREATE POLICY "Landlords can delete leases"
    ON public.leases FOR DELETE
    USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));

-- =====================================================
-- VERIFICATION: Check all policies
-- =====================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('profiles', 'tenants', 'tenant_property_links', 'leases')
ORDER BY tablename, policyname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All RLS policies have been updated successfully!';
    RAISE NOTICE '✅ You can now convert applicants to tenants.';
END $$;
