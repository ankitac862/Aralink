-- =====================================================
-- ONE-STEP FIX: Check and Create Tenant Links
-- =====================================================
-- Run this entire script at once in Supabase SQL Editor

-- ============ PART 1: DIAGNOSIS ============

-- Show current state
SELECT '=== CURRENT STATE ===' as section;

SELECT 'Total tenants' as metric, COUNT(*) as count FROM tenants
UNION ALL
SELECT 'Total properties' as metric, COUNT(*) as count FROM properties
UNION ALL
SELECT 'Total tenant_property_links' as metric, COUNT(*) as count FROM tenant_property_links
UNION ALL
SELECT 'Tenants WITHOUT links' as metric, COUNT(*) as count 
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE tpl.id IS NULL;

-- Show tenants without links (if any)
SELECT '=== TENANTS WITHOUT LINKS ===' as section;
SELECT 
    t.id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    t.property_id,
    t.status
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE tpl.id IS NULL;

-- ============ PART 2: FIX ============

-- Fix foreign key constraint
ALTER TABLE tenant_property_links DROP CONSTRAINT IF EXISTS tenant_property_links_tenant_id_fkey;
ALTER TABLE tenant_property_links ADD CONSTRAINT tenant_property_links_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Create missing links
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

-- ============ PART 3: VERIFICATION ============

SELECT '=== AFTER FIX ===' as section;

SELECT 'Total tenant_property_links' as metric, COUNT(*) as count FROM tenant_property_links
UNION ALL
SELECT 'Links with active status' as metric, COUNT(*) as count 
FROM tenant_property_links WHERE status = 'active'
UNION ALL
SELECT 'Tenants still WITHOUT links' as metric, COUNT(*) as count 
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE tpl.id IS NULL;

-- Show all tenant-property relationships
SELECT '=== ALL TENANT-PROPERTY LINKS ===' as section;
SELECT 
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    p.name as property_name,
    p.address1,
    tpl.status as link_status,
    t.status as tenant_status,
    tpl.created_at as linked_at
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
LEFT JOIN properties p ON p.id::text = tpl.property_id::text
ORDER BY tpl.created_at DESC;

-- Success message
DO $$
DECLARE
    link_count INT;
    tenant_count INT;
    no_link_count INT;
BEGIN
    SELECT COUNT(*) INTO link_count FROM tenant_property_links;
    SELECT COUNT(*) INTO tenant_count FROM tenants;
    SELECT COUNT(*) INTO no_link_count 
    FROM tenants t
    LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
    WHERE tpl.id IS NULL;
    
    RAISE NOTICE '================================';
    RAISE NOTICE '✅ FIX COMPLETE!';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total tenants: %', tenant_count;
    RAISE NOTICE 'Total links: %', link_count;
    RAISE NOTICE 'Tenants without links: %', no_link_count;
    RAISE NOTICE '';
    
    IF no_link_count = 0 THEN
        RAISE NOTICE '🎉 SUCCESS: All tenants have property links!';
        RAISE NOTICE '👉 Refresh your app to see tenants.';
    ELSE
        RAISE NOTICE '⚠️ WARNING: % tenants still without links', no_link_count;
        RAISE NOTICE '👉 Check if tenants have valid property_id';
    END IF;
    RAISE NOTICE '================================';
END $$;
