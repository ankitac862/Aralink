-- =====================================================
-- APPLICANTS SYSTEM SETUP
-- Complete setup for applicant invitations and tracking
-- =====================================================

-- Note: The 'invites' table already handles both tenant and applicant invites
-- Three tables work together:
-- 1. applicants - Basic info about people landlord wants to invite
-- 2. invites - Invitation records linking applicants to properties
-- 3. applications - Submitted application forms (after invite is accepted)

-- =====================================================
-- APPLICANTS TABLE
-- Store basic information about applicants landlord wants to invite
-- =====================================================
CREATE TABLE IF NOT EXISTS public.applicants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    
    -- Applicant basic info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'invited' 
        CHECK (status IN ('invited', 'pending', 'applied', 'approved', 'rejected')),
    
    -- Related records
    invite_id UUID REFERENCES public.invites(id) ON DELETE SET NULL,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    
    -- Timestamps
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_applicants_landlord_id ON public.applicants(landlord_id);
CREATE INDEX IF NOT EXISTS idx_applicants_property_id ON public.applicants(property_id);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON public.applicants(email);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON public.applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_invite_id ON public.applicants(invite_id);

-- Enable RLS
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Landlords can view their own applicants" ON public.applicants;
DROP POLICY IF EXISTS "Applicants can view their own record" ON public.applicants;
DROP POLICY IF EXISTS "Landlords can create applicants" ON public.applicants;
DROP POLICY IF EXISTS "Landlords can update their own applicants" ON public.applicants;
DROP POLICY IF EXISTS "Landlords can delete their own applicants" ON public.applicants;

-- RLS Policies
CREATE POLICY "Landlords can view their own applicants"
    ON public.applicants FOR SELECT
    USING (auth.uid() = landlord_id);

CREATE POLICY "Applicants can view their own record"
    ON public.applicants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users u
            WHERE u.email = applicants.email
            AND u.id = auth.uid()
        )
    );

CREATE POLICY "Landlords can create applicants"
    ON public.applicants FOR INSERT
    WITH CHECK (auth.uid() = landlord_id);

CREATE POLICY "Landlords can update their own applicants"
    ON public.applicants FOR UPDATE
    USING (auth.uid() = landlord_id);

CREATE POLICY "Landlords can delete their own applicants"
    ON public.applicants FOR DELETE
    USING (auth.uid() = landlord_id);

-- =====================================================
-- APPLICATIONS TABLE
-- Track applicant submissions (after they fill out the 6-step form)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    invite_id UUID REFERENCES public.invites(id) ON DELETE SET NULL,
    
    -- Applicant info
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'submitted' 
        CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
    
    -- Application data (stored as JSONB)
    form_data JSONB,
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_property_id ON public.applications(property_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_email ON public.applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON public.applications(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
DROP POLICY IF EXISTS "Property owners can view applications for their properties" ON public.applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update their own applications" ON public.applications;
DROP POLICY IF EXISTS "Property owners can update applications" ON public.applications;

-- RLS Policies
CREATE POLICY "Users can view their own applications"
    ON public.applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Property owners can view applications for their properties"
    ON public.applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create applications"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
    ON public.applications FOR UPDATE
    USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Property owners can update applications"
    ON public.applications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_id 
            AND p.user_id = auth.uid()
        )
    );

-- =====================================================
-- INVITES TABLE (Already exists, but ensure it's set up)
-- Used for both tenant and applicant invites
-- =====================================================

-- Ensure the invites table exists with proper structure
-- (This should already be created from TENANT_LANDLORD_CONNECTIONS.sql)

DO $$ 
BEGIN
    -- Check if invites table exists, if not create it
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invites') THEN
        CREATE TABLE public.invites (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            token_hash TEXT NOT NULL,
            property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
            landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            tenant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            tenant_email TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT invites_token_hash_not_empty CHECK (token_hash <> '')
        );

        CREATE INDEX idx_invites_property_id ON public.invites(property_id);
        CREATE INDEX idx_invites_tenant_email ON public.invites(tenant_email);
        CREATE INDEX idx_invites_tenant_id ON public.invites(tenant_id);
        CREATE INDEX idx_invites_status ON public.invites(status);
        CREATE INDEX idx_invites_expires_at ON public.invites(expires_at);

        CREATE UNIQUE INDEX idx_invites_pending_unique
        ON public.invites (tenant_email, property_id)
        WHERE status = 'pending';

        ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- NOTIFICATIONS TABLE (Already set up)
-- Used for both tenant and applicant notifications
-- =====================================================

-- Ensure notifications table has proper type for applicant invites
DO $$ 
BEGIN
    -- Add 'application' type if constraint exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notifications_type_check'
        AND table_name = 'notifications'
    ) THEN
        ALTER TABLE public.notifications 
        DROP CONSTRAINT notifications_type_check;
        
        ALTER TABLE public.notifications 
        ADD CONSTRAINT notifications_type_check 
        CHECK (type IN ('invite', 'maintenance', 'lease', 'payment', 'announcement', 'system', 'application'));
    END IF;
END $$;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get applicant count for a property (from applicants table)
CREATE OR REPLACE FUNCTION get_applicant_count(p_property_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.applicants
        WHERE property_id = p_property_id
        AND status IN ('invited', 'pending', 'applied')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_applicant_count(UUID) TO authenticated;

-- Function to get application count for a property
CREATE OR REPLACE FUNCTION get_application_count(p_property_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.applications
        WHERE property_id = p_property_id
        AND status IN ('submitted', 'under_review')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_application_count(UUID) TO authenticated;

-- Function to get pending invite count
CREATE OR REPLACE FUNCTION get_pending_invite_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.invites
        WHERE tenant_id = p_user_id
        AND status = 'pending'
        AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pending_invite_count(UUID) TO authenticated;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- You can uncomment this to test with sample data
/*
-- Create a test application
INSERT INTO public.applications (
    user_id,
    property_id,
    applicant_name,
    applicant_email,
    applicant_phone,
    status,
    form_data,
    submitted_at
) VALUES (
    auth.uid(),
    (SELECT id FROM public.properties LIMIT 1),
    'Test Applicant',
    'test@example.com',
    '555-0123',
    'submitted',
    '{"personal": {"fullName": "Test Applicant", "email": "test@example.com"}, "employment": {"employer": "Test Company"}}'::jsonb,
    NOW()
);
*/

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify setup
-- =====================================================

-- Check if tables exist
SELECT 
    'applicants' as table_name,
    EXISTS(SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'applicants') as exists;

SELECT 
    'applications' as table_name,
    EXISTS(SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'applications') as exists;

SELECT 
    'invites' as table_name,
    EXISTS(SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invites') as exists;

SELECT 
    'notifications' as table_name,
    EXISTS(SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') as exists;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('applicants', 'applications', 'invites', 'notifications')
ORDER BY tablename, policyname;
