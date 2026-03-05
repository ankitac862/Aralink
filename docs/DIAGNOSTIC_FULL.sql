    -- =====================================================
    -- COMPREHENSIVE DIAGNOSTIC
    -- =====================================================
    -- Run this to see the current state of your database

    -- 1. Check all tenants
    SELECT 
        id,
        first_name,
        last_name,
        email,
        property_id,
        status,
        created_at
    FROM tenants
    ORDER BY created_at DESC;

    -- 2. Check all tenant_property_links
    SELECT 
        id,
        tenant_id,
        property_id,
        status,
        created_via,
        created_at
    FROM tenant_property_links
    ORDER BY created_at DESC;

    -- 3. Check foreign key on tenant_property_links
    SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS references_table,
        ccu.column_name AS references_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'tenant_property_links'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'tenant_id';

    -- 4. Try to join tenants with their links (will fail if FK is wrong)
    SELECT 
        t.id as tenant_id,
        t.first_name,
        t.last_name,
        t.email,
        tpl.id as link_id,
        tpl.property_id,
        tpl.status as link_status
    FROM tenants t
    LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
    ORDER BY t.created_at DESC;

    -- 5. Check if there are tenant records WITHOUT links
    SELECT 
        t.id,
        t.first_name,
        t.last_name,
        t.email,
        'NO LINK' as issue
    FROM tenants t
    LEFT JOIN tenant_property_links tpl ON tpl.tenant_id = t.id
    WHERE tpl.id IS NULL;
