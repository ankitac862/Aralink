-- =====================================================
-- CHECK FOR DUPLICATE TENANT CREATION ISSUE
-- =====================================================

-- 1. Check if any application created multiple tenants
SELECT 'Applications with multiple tenant conversions' as query;
SELECT 
    l.application_id,
    COUNT(DISTINCT t.id) as tenant_count,
    STRING_AGG(DISTINCT t.id::text, ', ') as tenant_ids,
    STRING_AGG(DISTINCT t.first_name || ' ' || t.last_name, ', ') as tenant_names,
    STRING_AGG(DISTINCT t.status, ', ') as statuses
FROM leases l
INNER JOIN tenants t ON t.property_id::text = l.property_id::text
WHERE l.application_id IS NOT NULL
GROUP BY l.application_id
HAVING COUNT(DISTINCT t.id) > 1;

-- 2. Check tenants created within same second (likely duplicates)
SELECT 'Tenants created at exact same time' as query;
SELECT 
    t1.id as tenant1_id,
    t2.id as tenant2_id,
    t1.first_name || ' ' || t1.last_name as name,
    t1.email,
    t1.property_id,
    t1.created_at,
    t1.status as tenant1_status,
    t2.status as tenant2_status
FROM tenants t1
INNER JOIN tenants t2 ON 
    t2.email = t1.email 
    AND t2.property_id::text = t1.property_id::text
    AND t2.id > t1.id
    AND t2.created_at - t1.created_at < INTERVAL '5 seconds'
ORDER BY t1.created_at DESC;

-- 3. Check if leases have tenant_id set
SELECT 'Leases with application_id and their tenant status' as query;
SELECT 
    l.id as lease_id,
    l.application_id,
    l.tenant_id,
    l.status as lease_status,
    a.applicant_name,
    a.applicant_email,
    CASE 
        WHEN l.tenant_id IS NOT NULL THEN 'Has tenant_id'
        ELSE 'No tenant_id'
    END as tenant_status
FROM leases l
LEFT JOIN applications a ON a.id = l.application_id
WHERE l.application_id IS NOT NULL
ORDER BY l.created_at DESC;

-- 4. Show recently created tenants (last 24 hours)
SELECT 'Recently created tenants' as query;
SELECT 
    t.id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.status,
    t.property_id,
    t.created_at,
    COUNT(tpl.id) as link_count
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
GROUP BY t.id, t.first_name, t.last_name, t.email, t.status, t.property_id, t.created_at
ORDER BY t.created_at DESC;
