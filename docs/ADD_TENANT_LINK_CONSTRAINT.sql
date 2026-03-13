-- =====================================================
-- ADD UNIQUE CONSTRAINT to tenant_property_links
-- =====================================================
-- Prevents duplicate tenant-property links
-- This ensures one tenant can only be linked to a property once

-- First, check if constraint already exists
DO $$ 
BEGIN
    -- Add unique constraint on tenant_id + property_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tenant_property_links_tenant_property_unique'
    ) THEN
        ALTER TABLE tenant_property_links
        ADD CONSTRAINT tenant_property_links_tenant_property_unique 
        UNIQUE (tenant_id, property_id);
        
        RAISE NOTICE '✅ Added unique constraint to tenant_property_links';
    ELSE
        RAISE NOTICE '⚠️ Unique constraint already exists on tenant_property_links';
    END IF;
END $$;

-- Verify the constraint
SELECT
    con.conname as constraint_name,
    con.contype as constraint_type,
    ARRAY_AGG(att.attname) as columns
FROM pg_constraint con
INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
WHERE con.conrelid = 'tenant_property_links'::regclass
    AND con.contype = 'u' -- unique constraint
GROUP BY con.conname, con.contype;
