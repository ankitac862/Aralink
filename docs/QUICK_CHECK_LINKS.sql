-- =====================================================
-- QUICK CHECK: Do tenant_property_links exist?
-- =====================================================

-- 1. How many tenant_property_links exist?
SELECT 'Total tenant_property_links' as query, COUNT(*) as count
FROM tenant_property_links;

-- 2. How many tenants exist?
SELECT 'Total tenants' as query, COUNT(*) as count
FROM tenants;

-- 3. How many tenants have NO link?
SELECT 'Tenants WITHOUT links' as query;
SELECT 
    t.id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    t.property_id,
    'NO LINK FOUND' as issue
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE tpl.id IS NULL;

-- 4. Show all links with tenant names
SELECT 'All Links with Tenant Names' as query;
SELECT 
    tpl.id as link_id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    tpl.property_id,
    tpl.status,
    tpl.created_at
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
ORDER BY tpl.created_at DESC;

-- 5. Check property_id format match
SELECT 'Property ID Format Check' as query;
SELECT 
    'Tenant property_id sample' as source,
    property_id as sample_value,
    LENGTH(property_id) as length
FROM tenants
LIMIT 3
UNION ALL
SELECT 
    'Properties id sample (as text)' as source,
    id::text as sample_value,
    LENGTH(id::text) as length
FROM properties
LIMIT 3
UNION ALL
SELECT 
    'tenant_property_links property_id sample' as source,
    property_id as sample_value,
    LENGTH(property_id) as length
FROM tenant_property_links
LIMIT 3;
