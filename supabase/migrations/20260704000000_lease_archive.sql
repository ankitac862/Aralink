-- ============================================================
-- Lease archive: table + storage bucket setup instructions
-- Stores a copy of fully-signed lease documents before delete
-- or replace, with full metadata for audit/legal purposes.
-- ============================================================

-- ── lease_archives ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lease_archives (
  id                      UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_lease_id       UUID          NOT NULL,
  user_id                 UUID,                          -- landlord who triggered the action
  property_id             TEXT,                          -- TEXT matches leases.property_id
  unit_id                 TEXT,
  tenant_id               UUID,
  -- Original document location (lease-documents bucket)
  original_document_url   TEXT,
  original_storage_key    TEXT,
  -- Archived copy location (lease-archives bucket)
  archived_document_url   TEXT,
  archived_storage_key    TEXT,
  -- Archive context
  archive_reason          TEXT          NOT NULL CHECK (archive_reason IN ('deleted', 'replaced')),
  original_status         TEXT          NOT NULL,        -- lease.status at time of archive
  archived_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  archived_by             UUID,                          -- user.id who performed the action
  -- Snapshot of key lease dates for offline reference
  lease_effective_date    DATE,
  lease_expiry_date       DATE,
  -- Full form snapshot so the lease content is preserved even after the row is deleted
  form_data               JSONB
);

CREATE INDEX IF NOT EXISTS idx_lease_archives_original_lease_id ON public.lease_archives (original_lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_archives_property_id       ON public.lease_archives (property_id);
CREATE INDEX IF NOT EXISTS idx_lease_archives_tenant_id         ON public.lease_archives (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lease_archives_archived_at       ON public.lease_archives (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_lease_archives_user_id           ON public.lease_archives (user_id);

ALTER TABLE public.lease_archives ENABLE ROW LEVEL SECURITY;

-- Landlords can read their own archived leases
CREATE POLICY "landlord_read_own_lease_archives"
  ON public.lease_archives FOR SELECT
  USING (user_id = auth.uid());

-- Landlords can insert (archiving is always initiated by the authenticated landlord)
CREATE POLICY "landlord_insert_lease_archives"
  ON public.lease_archives FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policies — archives are write-once

-- ============================================================
-- Storage buckets required (run once via Supabase dashboard
-- or SQL below using the storage schema):
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES
--     ('lease-documents', 'lease-documents', true),
--     ('lease-archives',  'lease-archives',  false)
--   ON CONFLICT (id) DO NOTHING;
--
-- lease-documents: public  — PDFs are accessed via direct URL
-- lease-archives:  private — accessed via service_role only
--
-- Storage RLS for lease-documents (already in use):
--   - authenticated users can upload to leases/{userId}/...
--   - public read (URLs are shared with tenants)
--
-- Storage RLS for lease-archives:
--   - Only service_role can read/write (no client-side access)
-- ============================================================

-- Create buckets if using storage schema directly:
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('lease-documents', 'lease-documents', true),
  ('lease-archives',  'lease-archives',  false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for lease-documents bucket
CREATE POLICY "lease_documents_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lease-documents');

CREATE POLICY "lease_documents_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'lease-documents');

CREATE POLICY "lease_documents_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lease-documents' AND (storage.foldername(name))[2] = auth.uid()::text);

-- RLS policies for lease-archives bucket (service_role only — no public policies)
