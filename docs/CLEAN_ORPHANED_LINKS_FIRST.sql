-- =====================================================
-- CLEAN ORPHANED LINKS: Remove any existing bad data first
-- =====================================================

-- Step 1: Show current state
SELECT 'Current tenant_property_links' as query;
SELECT 
    tpl.id,
    tpl.tenant_id,
    tpl.property_id,
    tpl.unit_id,
    CASE 
        WHEN t.id IS NULL THEN '❌ ORPHANED - tenant does not exist'
        ELSE '✅ Valid'
    END as status
FROM tenant_property_links tpl
LEFT JOIN tenants t ON t.id = tpl.tenant_id;

-- Step 2: Count orphaned vs valid links
SELECT 
    COUNT(*) as total_links,
    COUNT(t.id) as valid_links,
    COUNT(*) - COUNT(t.id) as orphaned_links
FROM tenant_property_links tpl
LEFT JOIN tenants t ON t.id = tpl.tenant_id;

-- Step 3: Check if the specific problematic tenant exists
SELECT 'Checking problematic tenant ID' as query;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM tenants WHERE id = '5958e63b-e5ad-4bfa-803a-5b2c288a842d') 
        THEN '✅ Tenant EXISTS in tenants table'
        ELSE '❌ Tenant DOES NOT EXIST in tenants table'
    END as tenant_exists;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM tenant_property_links WHERE tenant_id = '5958e63b-e5ad-4bfa-803a-5b2c288a842d') 
        THEN '⚠️ Link EXISTS in tenant_property_links (orphaned)'
        ELSE '✅ No link with this tenant_id'
    END as link_exists;

-- Step 4: DELETE any orphaned tenant_property_links
-- (Links that point to non-existent tenants)
DELETE FROM tenant_property_links
WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- Step 5: Show what's left
SELECT 'Remaining tenant_property_links after cleanup' as query;
SELECT 
    tpl.*,
    t.first_name,
    t.last_name
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id;

-- Step 6: Now we can safely drop and recreate the FK
ALTER TABLE tenant_property_links DROP CONSTRAINT IF EXISTS tenant_property_links_tenant_id_fkey;
ALTER TABLE tenant_property_links ADD CONSTRAINT tenant_property_links_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

SELECT '✅ Cleaned up orphaned links and fixed FK constraint!' as status;
