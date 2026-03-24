-- Create a function to process move-ins
CREATE OR REPLACE FUNCTION process_approved_move_ins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Find all tenant_property_links that are 'inactive' but have applications in 'move_in_approved'
    -- where the approved_move_in_date is today or in the past
    
    -- Update new links to active
    UPDATE tenant_property_links tpl
    SET 
        status = 'active',
        updated_at = NOW()
    FROM applications a
    WHERE 
        a.status = 'move_in_approved'
        AND a.move_in_status = 'approved'
        AND a.approved_move_in_date <= CURRENT_DATE
        AND tpl.property_id = a.property_id
        AND a.is_transfer = false;

    -- Handle transfers: Deactivate old, activate new
    WITH transferring_apps AS (
        SELECT user_id, current_property_id, property_id as new_property_id, approved_move_in_date
        FROM applications 
        WHERE status = 'move_in_approved' AND is_transfer = true AND approved_move_in_date <= CURRENT_DATE
    )
    -- Retire old links
    UPDATE tenant_property_links tpl
    SET 
        status = 'inactive',
        link_end_date = CURRENT_DATE,
        updated_at = NOW()
    FROM transferring_apps ta, tenants t
    WHERE tpl.tenant_id = t.id AND t.user_id = ta.user_id AND tpl.property_id = ta.current_property_id AND tpl.status = 'active';

    -- Activate new links
    UPDATE tenant_property_links tpl
    SET 
        status = 'active',
        updated_at = NOW()
    FROM transferring_apps ta, tenants t
    WHERE tpl.tenant_id = t.id AND t.user_id = ta.user_id AND tpl.property_id = ta.new_property_id AND tpl.status = 'inactive';

    -- Mark applications completed
    UPDATE applications
    SET status = 'completed'
    WHERE status = 'move_in_approved' AND approved_move_in_date <= CURRENT_DATE;
END;
$$;

-- Note: You would hook this up to pg_cron on the Supabase Dashboard:
-- select cron.schedule('process_move_ins_daily', '1 0 * * *', 'SELECT process_approved_move_ins()');
