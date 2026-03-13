-- =====================================================
-- DEBUG: Why tenants not showing for landlord
-- =====================================================

-- Replace 'YOUR_LANDLORD_USER_ID' with actual landlord user ID
-- Get from profiles table or auth.users table

-- 1. Check landlord's properties
SELECT 'Landlord Properties' as query;
SELECT 
    id,
    name,
    address1,
    city,
    user_id as landlord_id
FROM properties
WHERE user_id = 'YOUR_LANDLORD_USER_ID';

-- 2. Check all tenants in database
SELECT 'All Tenants in Database' as query;
SELECT 
    t.id,
    t.user_id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.property_id,
    t.status,
    p.name as property_name,
    p.user_id as property_landlord_id
FROM tenants t
LEFT JOIN properties p ON p.id::text = t.property_id::text
ORDER BY t.created_at DESC;

-- 3. Check tenant_property_links
SELECT 'Tenant Property Links' as query;
SELECT 
    tpl.id as link_id,
    tpl.tenant_id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    tpl.property_id,
    p.name as property_name,
    p.user_id as property_landlord_id,
    tpl.status as link_status,
    tpl.created_via,
    tpl.created_by_user_id
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
LEFT JOIN properties p ON p.id::text = tpl.property_id::text
ORDER BY tpl.created_at DESC;

-- 4. Check which tenants belong to which landlord
SELECT 'Tenants by Landlord' as query;
SELECT 
    p.user_id as landlord_id,
    COUNT(DISTINCT t.id) as tenant_count,
    STRING_AGG(DISTINCT t.first_name || ' ' || t.last_name, ', ') as tenant_names
FROM properties p
LEFT JOIN tenant_property_links tpl ON tpl.property_id::text = p.id::text
LEFT JOIN tenants t ON t.id = tpl.tenant_id
GROUP BY p.user_id;

-- 5. Check for specific landlord (REPLACE USER_ID)
SELECT 'Tenants for Specific Landlord' as query;
SELECT 
    t.id as tenant_id,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    t.status as tenant_status,
    tpl.status as link_status,
    p.name as property_name,
    tpl.created_at as linked_at
FROM properties p
INNER JOIN tenant_property_links tpl ON tpl.property_id::text = p.id::text
INNER JOIN tenants t ON t.id = tpl.tenant_id
WHERE p.user_id = 'YOUR_LANDLORD_USER_ID'
ORDER BY tpl.created_at DESC;

-- 6. Check if tenant has property but no link
SELECT 'Tenants with property_id but no tenant_property_link' as query;
SELECT 
    t.id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.property_id,
    p.name as property_name,
    p.user_id as landlord_id,
    'HAS PROPERTY_ID BUT NO LINK!' as issue
FROM tenants t
INNER JOIN properties p ON p.id::text = t.property_id::text
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id AND tpl.property_id::text = t.property_id::text
WHERE tpl.id IS NULL;
