-- =====================================================
-- CHECK FOR DUPLICATE TENANTS AND LINKS
-- =====================================================

-- 1. Check for duplicate tenant records (same email)
SELECT 'Duplicate Tenant Records' as query;
SELECT 
    email,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as tenant_ids,
    STRING_AGG(first_name || ' ' || last_name, ', ') as names,
    STRING_AGG(status, ', ') as statuses
FROM tenants
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 2. Check all tenant_property_links with status
SELECT 'All Tenant Property Links' as query;
SELECT 
    tpl.id,
    tpl.tenant_id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email as tenant_email,
    tpl.property_id,
    p.name as property_name,
    tpl.status as link_status,
    t.status as tenant_status,
    tpl.created_at
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
LEFT JOIN properties p ON p.id::text = tpl.property_id::text
ORDER BY t.email, tpl.created_at DESC;

-- 3. Check for duplicate links (same tenant + property)
SELECT 'Duplicate Links (same tenant + property)' as query;
SELECT 
    tenant_id,
    property_id,
    COUNT(*) as link_count,
    STRING_AGG(id::text, ', ') as link_ids,
    STRING_AGG(status, ', ') as statuses
FROM tenant_property_links
GROUP BY tenant_id, property_id
HAVING COUNT(*) > 1;

-- 4. Count tenants by status
SELECT 'Tenant Count by Status' as query;
SELECT 
    status,
    COUNT(*) as count
FROM tenants
GROUP BY status
ORDER BY count DESC;

-- 5. Check specific tenant with user_id to see their property access
SELECT 'Tenant Records with User IDs' as query;
SELECT 
    t.id,
    t.first_name,
    t.last_name,
    t.email,
    t.user_id,
    t.status,
    COUNT(tpl.id) as link_count
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
GROUP BY t.id, t.first_name, t.last_name, t.email, t.user_id, t.status
ORDER BY t.email, t.created_at DESC;
