-- Check the most recent tenant creation
SELECT 
    id,
    first_name,
    last_name,
    email,
    property_id,
    unit_id,
    status,
    created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 3;

-- Check tenant_property_links for that tenant
SELECT 
    tpl.id,
    tpl.tenant_id,
    tpl.property_id,
    tpl.status,
    tpl.created_at,
    t.first_name,
    t.last_name,
    t.email
FROM tenant_property_links tpl
LEFT JOIN tenants t ON t.id = tpl.tenant_id
ORDER BY tpl.created_at DESC
LIMIT 3;

-- Check if there are any applications left
SELECT 
    id,
    applicant_name,
    applicant_email,
    status,
    property_id,
    created_at
FROM applications
ORDER BY created_at DESC
LIMIT 5;

-- Check leases linked to the latest tenants
SELECT 
    l.id,
    l.tenant_id,
    l.application_id,
    l.status,
    l.signed_date,
    t.first_name,
    t.last_name,
    t.email
FROM leases l
LEFT JOIN tenants t ON t.id = l.tenant_id
WHERE l.tenant_id IS NOT NULL
ORDER BY l.updated_at DESC
LIMIT 3;
