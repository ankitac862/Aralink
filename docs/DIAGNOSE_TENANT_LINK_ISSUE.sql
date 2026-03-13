-- =====================================================
-- FIX TENANT PROPERTY LINKS QUERY ISSUE
-- =====================================================

-- The issue: tenant_property_links.tenant_id points to tenants.id
-- But tenant dashboard tries to query by user.id (authenticated user)
-- So we need to check if tenants table has proper user_id linking

-- 1. Check current tenant records and their user_id
SELECT 'Checking Tenants Table Structure' as query;
SELECT 
    t.id as tenant_record_id,
    t.user_id as auth_user_id,
    t.first_name,
    t.last_name,
    t.email,
    t.status,
    COUNT(tpl.id) as link_count
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
GROUP BY t.id, t.user_id, t.first_name, t.last_name, t.email, t.status
ORDER BY t.email, t.created_at DESC;

-- 2. Check if user_id matches any auth users
SELECT 'Tenants with vs without auth user_id' as query;
SELECT 
    CASE 
        WHEN user_id IS NOT NULL THEN 'Has user_id'
        ELSE 'Missing user_id'
    END as user_id_status,
    COUNT(*) as count
FROM tenants
GROUP BY 
    CASE 
        WHEN user_id IS NOT NULL THEN 'Has user_id'
        ELSE 'Missing user_id'
    END;

-- 3. Show tenant_property_links with both tenant record and auth user
SELECT 'Tenant Property Links Details' as query;
SELECT 
    tpl.id as link_id,
    tpl.tenant_id as tenant_record_id,
    t.user_id as auth_user_id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    t.status as tenant_status,
    tpl.status as link_status,
    tpl.property_id,
    p.name as property_name
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
LEFT JOIN properties p ON p.id::text = tpl.property_id::text
ORDER BY t.email, tpl.created_at DESC;

-- 4. Find duplicate tenants (same email) with different statuses
SELECT 'Duplicate Tenants by Email' as query;
SELECT 
    t.email,
    t.id as tenant_id,
    t.user_id,
    t.first_name || ' ' || t.last_name as name,
    t.status,
    t.created_at,
    COUNT(tpl.id) as link_count
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE t.email IN (
    SELECT email 
    FROM tenants 
    GROUP BY email 
    HAVING COUNT(*) > 1
)
GROUP BY t.email, t.id, t.user_id, t.first_name, t.last_name, t.status, t.created_at
ORDER BY t.email, t.created_at DESC;
