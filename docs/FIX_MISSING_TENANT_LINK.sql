-- URGENT FIX: Add missing tenant_property_links for John Smith
-- Run each query separately

-- Step 1: Verify John Smith's tenant exists
SELECT 
    t.id as tenant_id,
    t.first_name,
    t.last_name,
    t.email,
    t.property_id,
    t.unit_id
FROM tenants t
WHERE t.email = 'j@yopmail.com'
ORDER BY t.created_at DESC
LIMIT 1;

-- Step 2: Check if tenant_property_links already exists
SELECT * 
FROM tenant_property_links 
WHERE tenant_id = '5c525fb0-c446-4d1b-86f7-dee6543a439d';

-- Step 3: Create the link (run this only if step 2 shows no results)
INSERT INTO tenant_property_links (
    tenant_id,
    property_id,
    unit_id,
    status,
    created_via,
    created_by_user_id,
    link_start_date
) VALUES (
    '5c525fb0-c446-4d1b-86f7-dee6543a439d',
    '714e05b1-d2b7-4c77-879a-c03f473a88a6',
    '87c7ac14-056b-4c55-a758-ca3159c1f920',
    'active',
    'lease_creation',
    'adaee5e9-58b7-42c6-ad94-98cc26dba052',
    '2026-03-01'
);

-- Step 4: Verify the link was created
SELECT 
    tpl.id,
    tpl.tenant_id,
    tpl.property_id,
    tpl.status,
    t.first_name,
    t.last_name
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
WHERE tpl.tenant_id = '5c525fb0-c446-4d1b-86f7-dee6543a439d';
