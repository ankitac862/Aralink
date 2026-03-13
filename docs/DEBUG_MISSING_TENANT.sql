-- =====================================================
-- DEBUG: Check why tenant_id is not found
-- =====================================================

-- 1. Check if this specific tenant exists
SELECT 'Checking specific tenant' as query;
SELECT * FROM tenants WHERE id = '5958e63b-e5ad-4bfa-803a-5b2c288a842d';

-- 2. Check all existing tenant_property_links (should be empty based on diagnostic)
SELECT 'Existing tenant_property_links' as query;
SELECT 
    tpl.*,
    t.first_name,
    t.last_name,
    CASE 
        WHEN t.id IS NULL THEN '❌ ORPHANED - tenant does not exist'
        ELSE '✅ Valid'
    END as status
FROM tenant_property_links tpl
LEFT JOIN tenants t ON t.id = tpl.tenant_id;

-- 3. Check data type of tenant_id columns
SELECT 
    'tenant_property_links.tenant_id type' as column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'tenant_property_links' AND column_name = 'tenant_id'
UNION ALL
SELECT 
    'tenants.id type' as column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'tenants' AND column_name = 'id';

-- 4. List ALL tenant IDs to see what we have
SELECT 'All tenant IDs' as query;
SELECT id, first_name, last_name, email FROM tenants ORDER BY created_at DESC;

-- 5. Check if there's a mismatch between property ownership
SELECT 'Properties and their owners' as query;
SELECT 
    p.id as property_id,
    p.name as property_name,
    p.user_id as landlord_id,
    COUNT(t.id) as tenant_count
FROM properties p
LEFT JOIN tenants t ON t.property_id::text = p.id::text
GROUP BY p.id, p.name, p.user_id;
