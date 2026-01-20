-- =====================================================
-- Lease Management Tables Migration
-- Run this in your Supabase SQL Editor
-- This script is IDEMPOTENT - safe to run multiple times
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- LEASES TABLE
-- Main lease entity storing lease information
-- =====================================================
CREATE TABLE IF NOT EXISTS public.leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL,
    unit_id UUID,
    tenant_id UUID,
    application_id UUID,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'uploaded', 'sent', 'signed')),
    
    -- Ontario Lease Form Data (stored as JSONB)
    form_data JSONB,
    
    -- Document metadata
    document_url TEXT,
    document_storage_key TEXT,
    
    -- Important dates
    effective_date DATE,
    expiry_date DATE,
    signed_date TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leases_user_id ON public.leases(user_id);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON public.leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON public.leases(status);

-- Enable Row Level Security
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view their own leases" ON public.leases;
DROP POLICY IF EXISTS "Users can insert their own leases" ON public.leases;
DROP POLICY IF EXISTS "Users can update their own leases" ON public.leases;
DROP POLICY IF EXISTS "Users can delete their own leases" ON public.leases;
DROP POLICY IF EXISTS "Tenants can view their assigned leases" ON public.leases;

-- RLS Policies for leases
CREATE POLICY "Users can view their own leases"
    ON public.leases FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leases"
    ON public.leases FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leases"
    ON public.leases FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leases"
    ON public.leases FOR DELETE
    USING (auth.uid() = user_id);

-- Tenants can view leases assigned to them
CREATE POLICY "Tenants can view their assigned leases"
    ON public.leases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t 
            WHERE t.id = tenant_id 
            AND EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND p.email = t.email
            )
        )
    );

-- =====================================================
-- LEASE_DOCUMENTS TABLE
-- Version history for lease documents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.lease_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,
    engine_used TEXT DEFAULT 'standard' CHECK (engine_used IN ('xfa', 'standard', 'uploaded')),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add engine_used column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lease_documents' 
        AND column_name = 'engine_used'
    ) THEN
        ALTER TABLE public.lease_documents 
        ADD COLUMN engine_used TEXT DEFAULT 'standard' 
        CHECK (engine_used IN ('xfa', 'standard', 'uploaded'));
    END IF;
END $$;

-- Add index for lease document queries
CREATE INDEX IF NOT EXISTS idx_lease_documents_lease_id ON public.lease_documents(lease_id);

-- Enable RLS
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view documents for their leases" ON public.lease_documents;
DROP POLICY IF EXISTS "Users can insert documents for their leases" ON public.lease_documents;
DROP POLICY IF EXISTS "Tenants can view documents for their leases" ON public.lease_documents;

-- RLS Policies for lease_documents
CREATE POLICY "Users can view documents for their leases"
    ON public.lease_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leases l 
            WHERE l.id = lease_id 
            AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert documents for their leases"
    ON public.lease_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.leases l 
            WHERE l.id = lease_id 
            AND l.user_id = auth.uid()
        )
    );

-- Tenants can view documents for leases assigned to them
CREATE POLICY "Tenants can view documents for their leases"
    ON public.lease_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leases l 
            WHERE l.id = lease_id 
            AND l.status IN ('sent', 'signed')
            AND EXISTS (
                SELECT 1 FROM public.tenants t 
                WHERE t.id = l.tenant_id 
                AND EXISTS (
                    SELECT 1 FROM public.profiles p 
                    WHERE p.id = auth.uid() 
                    AND p.email = t.email
                )
            )
        )
    );

-- =====================================================
-- APPLICATIONS TABLE
-- Tenant rental applications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID,
    unit_id UUID,
    
    -- Applicant info
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'lease_ready', 'lease_signed')),
    
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

-- Enable RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view applications for their properties" ON public.applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.applications;
DROP POLICY IF EXISTS "Property owners can update applications" ON public.applications;

-- RLS Policies
CREATE POLICY "Users can view applications for their properties"
    ON public.applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_id 
            AND p.user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "Users can create applications"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

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
-- NOTIFICATIONS TABLE
-- In-app notifications for lease events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (TRUE); -- Edge functions use service role key

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- =====================================================
-- STORAGE BUCKET FOR LEASE DOCUMENTS
-- Run in Supabase Storage settings or via API
-- =====================================================

-- Note: Create this bucket via Supabase Dashboard or API:
-- Bucket name: lease-documents
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: application/pdf

-- Example policy (add via Dashboard):
-- INSERT: authenticated users can upload to their folder
-- SELECT: users can read documents for leases they own/are assigned to
-- DELETE: users can delete their own uploads

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_leases_updated_at ON public.leases;
CREATE TRIGGER update_leases_updated_at
    BEFORE UPDATE ON public.leases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON public.leases TO authenticated;
GRANT ALL ON public.lease_documents TO authenticated;
GRANT ALL ON public.applications TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
