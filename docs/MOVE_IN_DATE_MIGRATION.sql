-- Add move in flow to applications
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS proposed_move_in_date DATE,
ADD COLUMN IF NOT EXISTS approved_move_in_date DATE,
ADD COLUMN IF NOT EXISTS move_in_status VARCHAR(50) DEFAULT 'unselected' CHECK (move_in_status IN ('unselected', 'pending_approval', 'approved', 'declined')),
ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_property_id UUID REFERENCES properties(id);

-- Expand application statuses
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'lease_ready', 'lease_sent', 'lease_signed', 'move_in_approved', 'completed'));

-- Expand lease statuses to handle pending move-in
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_status_check;
ALTER TABLE leases ADD CONSTRAINT leases_status_check CHECK (status IN ('draft', 'generated', 'uploaded', 'sent', 'signed', 'signed_pending_move_in', 'active', 'terminated'));

-- Lease Versions (Store the un-signed PDF securely alongside signed)
ALTER TABLE leases 
ADD COLUMN IF NOT EXISTS original_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
