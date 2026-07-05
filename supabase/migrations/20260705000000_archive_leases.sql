-- ============================================================
-- archive_leases: full row clone of the leases table
-- Written before any lease delete, regardless of status.
-- Write-once. No UPDATE/DELETE policies.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.archive_leases (
  -- Mirror every production column
  id                      UUID          NOT NULL,
  user_id                 UUID,
  property_id             TEXT,
  unit_id                 TEXT,
  tenant_id               UUID,
  application_id          UUID,
  status                  TEXT,
  original_pdf_url        TEXT,
  signed_pdf_url          TEXT,
  document_url            TEXT,
  document_storage_key    TEXT,
  version                 INTEGER,
  form_data               JSONB,
  effective_date          DATE,
  expiry_date             DATE,
  signed_date             DATE,
  rejection_reason        TEXT,
  rejected_at             TIMESTAMPTZ,
  rejected_by             UUID,
  created_at              TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ,
  -- Archive metadata
  deleted_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_by              UUID
);

CREATE INDEX IF NOT EXISTS idx_archive_leases_id          ON public.archive_leases (id);
CREATE INDEX IF NOT EXISTS idx_archive_leases_property_id ON public.archive_leases (property_id);
CREATE INDEX IF NOT EXISTS idx_archive_leases_tenant_id   ON public.archive_leases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_archive_leases_deleted_at  ON public.archive_leases (deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_leases_user_id     ON public.archive_leases (user_id);

ALTER TABLE public.archive_leases ENABLE ROW LEVEL SECURITY;

-- Landlords can read their own archived leases
CREATE POLICY "landlord_read_own_archive_leases"
  ON public.archive_leases FOR SELECT
  USING (user_id = auth.uid());

-- Archive is always inserted by the authenticated landlord
CREATE POLICY "landlord_insert_archive_leases"
  ON public.archive_leases FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE — write-once
