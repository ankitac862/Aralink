-- =====================================================
-- SIMPLE FIX: Just fix the foreign key without adding data  
-- =====================================================

-- Drop the wrong foreign key
ALTER TABLE tenant_property_links DROP CONSTRAINT IF EXISTS tenant_property_links_tenant_id_fkey;

-- Add the correct foreign key
ALTER TABLE tenant_property_links ADD CONSTRAINT tenant_property_links_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Verify it worked
SELECT 
    tc.constraint_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'tenant_property_links' AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_name LIKE '%tenant_id%';
