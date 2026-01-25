-- =====================================================
-- ADD UNIT AND SUB_UNIT COLUMNS TO APPLICATIONS TABLE
-- Migration to store unit/subunit information with applications
-- =====================================================

-- Add unit_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'applications' 
        AND column_name = 'unit_id'
    ) THEN
        ALTER TABLE public.applications 
        ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;
        
        -- Add index for unit_id
        CREATE INDEX idx_applications_unit_id ON public.applications(unit_id);
        
        RAISE NOTICE 'Column unit_id added to applications table';
    ELSE
        RAISE NOTICE 'Column unit_id already exists in applications table';
    END IF;
END $$;

-- Add sub_unit_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'applications' 
        AND column_name = 'sub_unit_id'
    ) THEN
        ALTER TABLE public.applications 
        ADD COLUMN sub_unit_id UUID REFERENCES public.sub_units(id) ON DELETE SET NULL;
        
        -- Add index for sub_unit_id
        CREATE INDEX idx_applications_sub_unit_id ON public.applications(sub_unit_id);
        
        RAISE NOTICE 'Column sub_unit_id added to applications table';
    ELSE
        RAISE NOTICE 'Column sub_unit_id already exists in applications table';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'applications'
AND column_name IN ('unit_id', 'sub_unit_id')
ORDER BY column_name;
