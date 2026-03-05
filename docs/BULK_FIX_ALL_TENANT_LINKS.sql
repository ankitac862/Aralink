-- =====================================================
-- BULK FIX: Create missing tenant_property_links for ALL tenants
-- =====================================================

-- Step 1: Fix the foreign key constraint first
ALTER TABLE tenant_property_links DROP CONSTRAINT IF EXISTS tenant_property_links_tenant_id_fkey;
ALTER TABLE tenant_property_links ADD CONSTRAINT tenant_property_links_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Create tenant_property_links for ALL tenants that don't have them
-- This automatically uses each tenant's property_id, unit_id, and created date
INSERT INTO tenant_property_links (
    tenant_id,
    property_id,
    unit_id,
    status,
    created_via,
    created_by_user_id,
    link_start_date
)
SELECT 
    t.id as tenant_id,
    t.property_id,
    t.unit_id,
    'active' as status,
    'manual_fix' as created_via,
    p.user_id as created_by_user_id,
    t.start_date as link_start_date
FROM tenants t
INNER JOIN properties p ON p.id::text = t.property_id::text
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE tpl.id IS NULL  -- Only create links for tenants that don't have them
ON CONFLICT DO NOTHING;

-- Step 3: Verify all tenants now have links
SELECT 
    t.id as tenant_id,
    t.first_name,
    t.last_name,
    t.email,
    CASE 
        WHEN tpl.id IS NOT NULL THEN 'HAS LINK ✅'
        ELSE 'NO LINK ❌'
    END as status
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
ORDER BY t.created_at DESC;

-- Step 4: Show count of links created
SELECT 
    COUNT(*) as total_links,
    COUNT(DISTINCT tenant_id) as unique_tenants
FROM tenant_property_links;

-- Success message
DO $$
DECLARE
    link_count INT;
BEGIN
    SELECT COUNT(*) INTO link_count FROM tenant_property_links;
    RAISE NOTICE '✅ Foreign key fixed!';
    RAISE NOTICE '✅ Created missing tenant_property_links!';
    RAISE NOTICE '✅ Total tenant_property_links: %', link_count;
END $$;
