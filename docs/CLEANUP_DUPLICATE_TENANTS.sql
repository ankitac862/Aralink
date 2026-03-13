-- =====================================================
-- CLEAN UP DUPLICATE TENANTS
-- =====================================================

-- This script:
-- 1. Identifies duplicate tenant records (same user_id or email)
-- 2. Keeps only the ACTIVE tenant, or if none active, the most recent
-- 3. Deletes duplicate tenant_property_links
-- 4. Deletes duplicate tenant records

-- =====================================================
-- STEP 1: SHOW DUPLICATES FIRST (READ-ONLY)
-- =====================================================

-- Show duplicate tenants by user_id
SELECT 'Duplicates by user_id' as query;
SELECT 
    user_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ' ORDER BY 
        CASE WHEN status = 'active' THEN 1 ELSE 2 END,
        created_at DESC
    ) as tenant_ids,
    STRING_AGG(
        first_name || ' ' || last_name || ' (' || status || ')',
        ', ' 
        ORDER BY 
            CASE WHEN status = 'active' THEN 1 ELSE 2 END,
            created_at DESC
    ) as names_and_status
FROM tenants
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Show duplicate tenants by email
SELECT 'Duplicates by email' as query;
SELECT 
    email,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ' ORDER BY 
        CASE WHEN status = 'active' THEN 1 ELSE 2 END,
        created_at DESC
    ) as tenant_ids,
    STRING_AGG(
        first_name || ' ' || last_name || ' (' || status || ')',
        ', ' 
        ORDER BY 
            CASE WHEN status = 'active' THEN 1 ELSE 2 END,
            created_at DESC
    ) as names_and_status
FROM tenants
GROUP BY email
HAVING COUNT(*) > 1;

-- =====================================================
-- STEP 2: DELETE DUPLICATES (EXECUTE CAREFULLY!)
-- =====================================================

-- Create temp table with tenants to KEEP (active or most recent)
CREATE TEMP TABLE tenants_to_keep AS
SELECT DISTINCT ON (COALESCE(user_id, email))
    id
FROM tenants
ORDER BY 
    COALESCE(user_id, email),
    CASE WHEN status = 'active' THEN 1 ELSE 2 END,  -- Prefer active status
    created_at DESC;  -- If multiple actives or inactives, pick most recent

-- Show which tenants will be KEPT
SELECT 'Tenants that will be KEPT' as query;
SELECT 
    t.id,
    t.user_id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.status,
    t.created_at,
    COUNT(tpl.id) as link_count
FROM tenants t
INNER JOIN tenants_to_keep tk ON tk.id = t.id
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
GROUP BY t.id, t.user_id, t.first_name, t.last_name, t.email, t.status, t.created_at
ORDER BY t.email;

-- Show which tenants will be DELETED
SELECT 'Tenants that will be DELETED' as query;
SELECT 
    t.id,
    t.user_id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.status,
    t.created_at,
    COUNT(tpl.id) as link_count
FROM tenants t
LEFT JOIN tenants_to_keep tk ON tk.id = t.id
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
WHERE tk.id IS NULL
GROUP BY t.id, t.user_id, t.first_name, t.last_name, t.email, t.status, t.created_at
ORDER BY t.email;

-- Delete tenant_property_links for duplicate tenants
DELETE FROM tenant_property_links
WHERE tenant_id IN (
    SELECT t.id 
    FROM tenants t
    LEFT JOIN tenants_to_keep tk ON tk.id = t.id
    WHERE tk.id IS NULL
);

-- Delete duplicate tenant records
DELETE FROM tenants
WHERE id NOT IN (SELECT id FROM tenants_to_keep);

-- Clean up temp table
DROP TABLE tenants_to_keep;

-- =====================================================
-- STEP 3: VERIFY CLEANUP
-- =====================================================

SELECT 'Final tenant count' as query;
SELECT COUNT(*) as total_tenants FROM tenants;

SELECT 'Remaining duplicates by user_id' as query;
SELECT 
    user_id,
    COUNT(*) as count
FROM tenants
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

SELECT 'Remaining duplicates by email' as query;
SELECT 
    email,
    COUNT(*) as count
FROM tenants
GROUP BY email
HAVING COUNT(*) > 1;

SELECT 'All tenants after cleanup' as query;
SELECT 
    t.id,
    t.user_id,
    t.first_name || ' ' || t.last_name as name,
    t.email,
    t.status,
    COUNT(tpl.id) as link_count
FROM tenants t
LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
GROUP BY t.id, t.user_id, t.first_name, t.last_name, t.email, t.status
ORDER BY t.email;
