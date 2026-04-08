-- =====================================================
-- Maintenance Requests — full schema + multi-role support
-- Combines: CREATE_MAINTENANCE_REQUESTS_TABLE.sql
--           ADD_MAINTENANCE_CREATOR_TRACKING.sql
--           + approved_by / approved_at / tenant_feedback
-- =====================================================

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  tenant_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id     UUID REFERENCES public.units(id) ON DELETE SET NULL,
  sub_unit_id UUID REFERENCES public.sub_units(id) ON DELETE SET NULL,

  -- Request details
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('plumbing','electrical','hvac','appliance','general')),
  title       VARCHAR(255) NOT NULL,
  description TEXT        NOT NULL,
  urgency VARCHAR(20) NOT NULL
    CHECK (urgency IN ('low','medium','high','emergency')),

  -- Scheduling and access
  availability       TIMESTAMPTZ NOT NULL,
  permission_to_enter BOOLEAN    NOT NULL DEFAULT false,

  -- Attachments: [{ uri, type, size }]
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'under_review'
    CHECK (status IN ('new','under_review','in_progress','waiting_vendor','resolved','cancelled')),

  -- Multi-role creator tracking
  created_by_role VARCHAR(20) NOT NULL DEFAULT 'tenant'
    CHECK (created_by_role IN ('tenant','landlord','manager')),
  created_by_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Approval tracking (landlord/manager only)
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,

  -- Assignment and resolution
  assigned_vendor  VARCHAR(255),
  resolution_notes TEXT,
  expense_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,

  -- Tenant feedback (after resolution)
  tenant_feedback        TEXT,
  tenant_feedback_rating SMALLINT CHECK (tenant_feedback_rating BETWEEN 1 AND 5),

  -- Activity log: [{ id, timestamp, message, actor }]
  activity JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant     ON public.maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_landlord   ON public.maintenance_requests(landlord_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_property   ON public.maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status     ON public.maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_urgency    ON public.maintenance_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created_at ON public.maintenance_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created_by ON public.maintenance_requests(created_by_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_maintenance_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_maintenance_request_timestamp ON public.maintenance_requests;
CREATE TRIGGER trigger_update_maintenance_request_timestamp
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_maintenance_request_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Tenants: view own requests
CREATE POLICY "tenant_select_own"
  ON public.maintenance_requests FOR SELECT
  USING (auth.uid() = tenant_id);

-- Tenants: create requests as tenant role
CREATE POLICY "tenant_insert_own"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    auth.uid() = tenant_id
    AND auth.uid() = created_by_id
    AND created_by_role = 'tenant'
  );

-- Tenants: update own requests (field-level enforcement done in service layer)
CREATE POLICY "tenant_update_own"
  ON public.maintenance_requests FOR UPDATE
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

-- Landlords: view requests for properties they own
CREATE POLICY "landlord_select_property"
  ON public.maintenance_requests FOR SELECT
  USING (
    auth.uid() = landlord_id
    OR auth.uid() IN (
      SELECT user_id FROM public.properties WHERE id = maintenance_requests.property_id
    )
  );

-- Landlords: create requests for their properties
CREATE POLICY "landlord_insert"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_id
    AND created_by_role = 'landlord'
    AND auth.uid() IN (
      SELECT user_id FROM public.properties WHERE id = maintenance_requests.property_id
    )
  );

-- Managers: create requests (manager role)
CREATE POLICY "manager_insert"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_id
    AND created_by_role = 'manager'
  );

-- Landlords + managers: update requests for their properties
CREATE POLICY "landlord_update_property"
  ON public.maintenance_requests FOR UPDATE
  USING (
    auth.uid() = landlord_id
    OR auth.uid() IN (
      SELECT user_id FROM public.properties WHERE id = maintenance_requests.property_id
    )
  )
  WITH CHECK (
    auth.uid() = landlord_id
    OR auth.uid() IN (
      SELECT user_id FROM public.properties WHERE id = maintenance_requests.property_id
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.maintenance_requests TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- =====================================================
-- Storage bucket: maintenance-attachments (private, signed URLs)
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-attachments',
  'maintenance-attachments',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "auth_upload_maintenance"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maintenance-attachments');

CREATE POLICY IF NOT EXISTS "auth_view_maintenance"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'maintenance-attachments');

-- =====================================================
-- Helper Functions
-- =====================================================

CREATE OR REPLACE FUNCTION get_landlord_maintenance_stats(landlord_uuid UUID)
RETURNS TABLE (
  total_requests      BIGINT,
  new_requests        BIGINT,
  in_progress_requests BIGINT,
  resolved_requests   BIGINT,
  emergency_requests  BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status IN ('new','under_review'))::BIGINT,
    COUNT(*) FILTER (WHERE status IN ('in_progress','waiting_vendor'))::BIGINT,
    COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT,
    COUNT(*) FILTER (WHERE urgency = 'emergency')::BIGINT
  FROM public.maintenance_requests
  WHERE landlord_id = landlord_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.maintenance_requests
  IS 'Stores maintenance requests with full lifecycle tracking and multi-role creation support';
