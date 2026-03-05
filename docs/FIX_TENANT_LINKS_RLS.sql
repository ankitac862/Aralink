-- =====================================================
-- FIX: Tenant Property Links RLS for Landlord Access
-- =====================================================
-- Add policy to allow landlords to query tenant_property_links via properties

-- Drop existing policies
DROP POLICY IF EXISTS "Tenants can view their property links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can view property links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can view property links by landlord_id" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can insert property links" ON public.tenant_property_links;
DROP POLICY IF EXISTS "Landlords can update property links" ON public.tenant_property_links;

-- Tenants can view their own links
CREATE POLICY "Tenants can view their property links"
    ON public.tenant_property_links FOR SELECT
    USING (tenant_id = auth.uid());

-- Landlords can view links for properties they own
CREATE POLICY "Landlords can view property links"
    ON public.tenant_property_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
    );

-- Landlords can insert links for properties they own
CREATE POLICY "Landlords can insert property links"
    ON public.tenant_property_links FOR INSERT
    WITH CHECK (
        -- Allow if user owns the property
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
        OR
        -- Allow if the created_by_user_id owns the property (for tenant self-conversion)
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id
            AND p.user_id = created_by_user_id
        )
    );

-- Landlords can update links for properties they own
CREATE POLICY "Landlords can update property links"
    ON public.tenant_property_links FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_id
            AND p.user_id = auth.uid()
        )
    );

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'tenant_property_links'
ORDER BY policyname;
