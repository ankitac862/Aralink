-- =====================================================
-- FIX: tenant_property_links foreign key constraint
-- =====================================================
-- The tenant_id should reference tenants table, not profiles!

-- Step 1: Check current foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'tenant_property_links'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Step 2: Drop the incorrect foreign key
ALTER TABLE tenant_property_links
DROP CONSTRAINT IF EXISTS tenant_property_links_tenant_id_fkey;

-- Step 3: Add the correct foreign key to tenants table
ALTER TABLE tenant_property_links
ADD CONSTRAINT tenant_property_links_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 4: Now insert the missing link
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

-- Step 5: Verify it worked
SELECT 
    tpl.id,
    tpl.tenant_id,
    tpl.property_id,
    tpl.status,
    t.first_name,
    t.last_name,
    t.email
FROM tenant_property_links tpl
INNER JOIN tenants t ON t.id = tpl.tenant_id
WHERE tpl.tenant_id = '5c525fb0-c446-4d1b-86f7-dee6543a439d';

-- Success!
DO $$
BEGIN
    RAISE NOTICE '✅ Foreign key constraint fixed! tenant_property_links.tenant_id now references tenants table.';
    RAISE NOTICE '✅ John Smith tenant link created successfully!';
END $$;
