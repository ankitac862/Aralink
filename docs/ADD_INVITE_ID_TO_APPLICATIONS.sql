-- =====================================================
-- ADD INVITE_ID COLUMN TO APPLICATIONS TABLE
-- Migration to add missing invite_id column
-- =====================================================

-- Add invite_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'applications' 
        AND column_name = 'invite_id'
    ) THEN
        ALTER TABLE public.applications 
        ADD COLUMN invite_id UUID REFERENCES public.invites(id) ON DELETE SET NULL;
        
        -- Add index for invite_id
        CREATE INDEX idx_applications_invite_id ON public.applications(invite_id);
        
        RAISE NOTICE 'Column invite_id added to applications table';
    ELSE
        RAISE NOTICE 'Column invite_id already exists in applications table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'applications'
AND column_name = 'invite_id';
