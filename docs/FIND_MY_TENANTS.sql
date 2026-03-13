-- =====================================================
-- SIMPLE DIAGNOSTIC: Find Your Tenants
-- =====================================================

-- Step 1: Find YOUR user ID (copy this for next queries)
SELECT 'Your User ID' as info;
SELECT 
    id as your_user_id,
    email,
    full_name
FROM profiles
WHERE email = 'YOUR_EMAIL_HERE'  -- REPLACE WITH YOUR EMAIL
LIMIT 1;

-- Step 2: Your Properties
SELECT 'Your Properties' as info;
SELECT 
    id as property_id,
    name,
    address1,
    city
FROM properties
WHERE user_id = 'PASTE_YOUR_USER_ID_HERE'  -- PASTE FROM STEP 1
ORDER BY created_at DESC;

-- Step 3: Check Tenant Records
SELECT 'Tenant Records' as info;
SELECT 
    t.id as tenant_id,
    t.first_name,
    t.last_name,
    t.email,
    t.property_id,
    t.status,
    t.created_at
FROM tenants t
ORDER BY t.created_at DESC
LIMIT 20;

-- Step 4: Check Tenant Property Links
SELECT 'Tenant Property Links' as info;
SELECT 
    tpl.id as link_id,
    tpl.tenant_id,
    tpl.property_id,
    tpl.status,
    tpl.created_at
FROM tenant_property_links tpl
ORDER BY tpl.created_at DESC
LIMIT 20;

-- Step 5: THE KEY QUESTION - Are tenants linked to YOUR properties?
SELECT 'Tenants Linked to Your Properties' as info;
SELECT 
    p.name as property_name,
    t.first_name || ' ' || t.last_name as tenant_name,
    t.email,
    tpl.status as link_status,
    t.status as tenant_status
FROM properties p
LEFT JOIN tenant_property_links tpl ON tpl.property_id::text = p.id::text
LEFT JOIN tenants t ON t.id = tpl.tenant_id
WHERE p.user_id = 'PASTE_YOUR_USER_ID_HERE'  -- PASTE FROM STEP 1
ORDER BY tpl.created_at DESC;

-- Step 6: Check if property_id types match
SELECT 'Property ID Type Check' as info;
SELECT 
    'properties.id type' as table_column,
    pg_typeof(id) as data_type
FROM properties
LIMIT 1
UNION ALL
SELECT 
    'tenant_property_links.property_id type' as table_column,
    pg_typeof(property_id) as data_type
FROM tenant_property_links
LIMIT 1;

-- Step 7: Direct tenant-property link WITHOUT casting
SELECT 'Direct Link Check (no casting)' as info;
SELECT 
    p.id as property_id,
    p.name as property_name,
    tpl.property_id as link_property_id,
    CASE 
        WHEN p.id = tpl.property_id THEN '✅ MATCH'
        ELSE '❌ NO MATCH'
    END as match_status
FROM properties p
LEFT JOIN tenant_property_links tpl ON p.id = tpl.property_id
WHERE p.user_id = 'PASTE_YOUR_USER_ID_HERE'  -- PASTE FROM STEP 1
LIMIT 5;

-- Step 8: Alternative - Cast property to text
SELECT 'Cast to Text Check' as info;
SELECT 
    p.id::text as property_id,
    p.name as property_name,
    tpl.property_id as link_property_id,
    CASE 
        WHEN p.id::text = tpl.property_id THEN '✅ MATCH'
        ELSE '❌ NO MATCH'
    END as match_status
FROM properties p
LEFT JOIN tenant_property_links tpl ON p.id::text = tpl.property_id
WHERE p.user_id = 'PASTE_YOUR_USER_ID_HERE'  -- PASTE FROM STEP 1
LIMIT 5;
