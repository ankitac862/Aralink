-- =====================================================
-- FIX: Tenants Table RLS Policies
-- =====================================================
-- Allow landlords to view tenants via tenant_property_links

-- Enable RLS on tenants table
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Tenants can view own record" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can view their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete their tenants" ON public.tenants;

-- Tenants can view their own record
CREATE POLICY "Tenants can view own record"
    ON public.tenants FOR SELECT
    USING (user_id = auth.uid());

-- Landlords can view tenants linked to their properties
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

-- Landlords can insert tenants (for their properties) AND tenants can create their own record
CREATE POLICY "Anyone can insert tenants"
    ON public.tenants FOR INSERT
    WITH CHECK (true); -- Allow all inserts, will be secured via tenant_property_links

-- Landlords can update tenants linked to their properties
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

-- Landlords can delete tenants linked to their properties
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

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY policyname;
