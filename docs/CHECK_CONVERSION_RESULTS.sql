-- =====================================================
-- DIAGNOSTIC: Check what was created during conversion
-- =====================================================

-- 1. Check if tenant was created
SELECT 
    id,
    user_id,
    first_name,
    last_name,
    email,
    property_id,
    unit_id,
    status,
    created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check tenant_property_links
SELECT 
    id,
    tenant_id,
    property_id,
    unit_id,
    status,
    created_via,
    created_by_user_id,
    link_start_date,
    created_at
FROM tenant_property_links
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check if lease was updated with tenant_id
SELECT 
    id,
    tenant_id,
    application_id,
    property_id,
    status,
    signed_date,
    created_at
FROM leases
WHERE tenant_id IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- 4. Check remaining applications (should be deleted)
SELECT 
    id,
    applicant_name,
    applicant_email,
    status,
    property_id
FROM applications
WHERE status = 'approved'
ORDER BY created_at DESC;

-- 5. Join query to verify tenant visibility for landlords
-- Replace 'YOUR_LANDLORD_USER_ID' with your actual user ID
SELECT 
    t.id as tenant_id,
    t.first_name,
    t.last_name,
    t.email,
    tpl.property_id,
    tpl.status as link_status,
    p.address1 as property_address,
    p.user_id as landlord_id
FROM tenants t
INNER JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
INNER JOIN properties p ON p.id = tpl.property_id
-- WHERE p.user_id = 'YOUR_LANDLORD_USER_ID'
ORDER BY t.created_at DESC;
