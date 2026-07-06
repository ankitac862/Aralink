-- ============================================================
-- Archive tables for soft-delete-with-archive flow
-- Mirror original columns + deleted_at + deleted_by only.
-- Write-once. No UPDATE/DELETE policies. Query via SQL editor.
-- ============================================================

-- ── archive_properties ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_properties (
  id                    UUID          NOT NULL,
  user_id               UUID,
  name                  TEXT,
  address1              TEXT,
  address2              TEXT,
  city                  TEXT,
  state                 TEXT,
  zip_code              TEXT,
  country               TEXT,
  property_type         TEXT,
  landlord_name         TEXT,
  rent_complete_property BOOLEAN,
  description           TEXT,
  photos                TEXT[],
  parking_included      BOOLEAN,
  rent_amount           DECIMAL(10,2),
  utilities             JSONB,
  status                TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  -- Archive metadata
  deleted_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_archive_properties_id         ON public.archive_properties (id);
CREATE INDEX IF NOT EXISTS idx_archive_properties_deleted_at ON public.archive_properties (deleted_at);
CREATE INDEX IF NOT EXISTS idx_archive_properties_user_id    ON public.archive_properties (user_id);

ALTER TABLE public.archive_properties ENABLE ROW LEVEL SECURITY;
-- No client-readable policies — query via service_role / SQL editor only.

-- ── archive_units ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_units (
  id                    UUID          NOT NULL,
  property_id           UUID,
  name                  TEXT,
  description           TEXT,
  unit_type             TEXT,
  bedrooms              INTEGER,
  bathrooms             INTEGER,
  area                  DECIMAL(10,2),
  rent_entire_unit      BOOLEAN,
  default_rent_price    DECIMAL(10,2),
  availability_date     DATE,
  lease_start_date      DATE,
  lease_end_date        DATE,
  photos                TEXT[],
  amenities             JSONB,
  tenant_id             UUID,
  is_occupied           BOOLEAN,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  -- Archive metadata
  deleted_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_archive_units_id          ON public.archive_units (id);
CREATE INDEX IF NOT EXISTS idx_archive_units_property_id ON public.archive_units (property_id);
CREATE INDEX IF NOT EXISTS idx_archive_units_deleted_at  ON public.archive_units (deleted_at);

ALTER TABLE public.archive_units ENABLE ROW LEVEL SECURITY;

-- ── archive_sub_units ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_sub_units (
  id                    UUID          NOT NULL,
  unit_id               UUID,
  name                  TEXT,
  type                  TEXT,
  rent_price            DECIMAL(10,2),
  area                  DECIMAL(10,2),
  availability_date     DATE,
  photos                TEXT[],
  amenities             TEXT[],
  shared_spaces         TEXT[],
  tenant_id             UUID,
  tenant_name           TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  -- Archive metadata
  deleted_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_archive_sub_units_id         ON public.archive_sub_units (id);
CREATE INDEX IF NOT EXISTS idx_archive_sub_units_unit_id    ON public.archive_sub_units (unit_id);
CREATE INDEX IF NOT EXISTS idx_archive_sub_units_deleted_at ON public.archive_sub_units (deleted_at);

ALTER TABLE public.archive_sub_units ENABLE ROW LEVEL SECURITY;

-- ── archive_tenants ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_tenants (
  id                    UUID          NOT NULL,
  user_id               UUID,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  phone                 TEXT,
  property_id           TEXT,
  unit_id               TEXT,
  unit_name             TEXT,
  photo                 TEXT,
  start_date            DATE,
  end_date              DATE,
  rent_amount           DECIMAL(10,2),
  status                TEXT,
  payments              JSONB,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  -- Archive metadata
  deleted_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_archive_tenants_id          ON public.archive_tenants (id);
CREATE INDEX IF NOT EXISTS idx_archive_tenants_property_id ON public.archive_tenants (property_id);
CREATE INDEX IF NOT EXISTS idx_archive_tenants_deleted_at  ON public.archive_tenants (deleted_at);

ALTER TABLE public.archive_tenants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: check whether an entity has an active tenant
-- Returns: { has_tenant: bool, tenant_name: text|null, tenant_count: int }
-- entity_type: 'property' | 'unit' | 'subunit' | 'tenant'
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_entity_has_tenant(
  p_entity_type TEXT,
  p_entity_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_count  INTEGER := 0;
  v_tenant_name   TEXT;
  v_tmp_count     INTEGER;
  v_tmp_name      TEXT;
BEGIN
  IF p_entity_type = 'property' THEN
    -- Check tenants table (cast both sides to TEXT to handle UUID or TEXT column)
    SELECT COUNT(*), MIN(first_name || ' ' || last_name)
    INTO v_tenant_count, v_tenant_name
    FROM tenants
    WHERE property_id::TEXT = p_entity_id::TEXT AND status = 'active';

    -- Also check tenant_property_links for room-level tenants
    IF v_tenant_count = 0 THEN
      SELECT COUNT(*), MIN(t.first_name || ' ' || t.last_name)
      INTO v_tmp_count, v_tmp_name
      FROM tenant_property_links tpl
      JOIN tenants t ON t.id = tpl.tenant_id
      WHERE tpl.property_id::TEXT = p_entity_id::TEXT
        AND tpl.status = 'active';
      IF v_tmp_count > 0 THEN
        v_tenant_count := v_tmp_count;
        v_tenant_name  := v_tmp_name;
      END IF;
    END IF;

    -- Also catch units marked occupied without a tenants-table record
    IF v_tenant_count = 0 THEN
      SELECT COUNT(*) INTO v_tmp_count
      FROM units
      WHERE property_id = p_entity_id AND is_occupied = TRUE;
      v_tenant_count := COALESCE(v_tmp_count, 0);
    END IF;

  ELSIF p_entity_type = 'unit' THEN
    -- Check tenants table (unit_id stored as TEXT)
    SELECT COUNT(*), MIN(first_name || ' ' || last_name)
    INTO v_tenant_count, v_tenant_name
    FROM tenants
    WHERE unit_id = p_entity_id::TEXT AND status = 'active';

    -- Check tenant_property_links for this unit (including sub-units)
    IF v_tenant_count = 0 THEN
      SELECT COUNT(*), MIN(t.first_name || ' ' || t.last_name)
      INTO v_tmp_count, v_tmp_name
      FROM tenant_property_links tpl
      JOIN tenants t ON t.id = tpl.tenant_id
      WHERE tpl.unit_id = p_entity_id
        AND tpl.status = 'active';
      IF v_tmp_count > 0 THEN
        v_tenant_count := v_tmp_count;
        v_tenant_name  := v_tmp_name;
      END IF;
    END IF;

    -- Check units.is_occupied
    IF v_tenant_count = 0 THEN
      SELECT COUNT(*) INTO v_tmp_count
      FROM units WHERE id = p_entity_id AND is_occupied = TRUE;
      v_tenant_count := COALESCE(v_tmp_count, 0);
    END IF;

  ELSIF p_entity_type = 'subunit' THEN
    -- Check tenant_property_links for this sub-unit
    SELECT COUNT(*), MIN(t.first_name || ' ' || t.last_name)
    INTO v_tenant_count, v_tenant_name
    FROM tenant_property_links tpl
    JOIN tenants t ON t.id = tpl.tenant_id
    WHERE tpl.sub_unit_id = p_entity_id
      AND tpl.status = 'active';

    -- Fallback: inline tenant_name on sub_units
    IF v_tenant_count = 0 THEN
      SELECT COUNT(*), MIN(tenant_name)
      INTO v_tmp_count, v_tmp_name
      FROM sub_units
      WHERE id = p_entity_id
        AND (tenant_id IS NOT NULL OR tenant_name IS NOT NULL);
      IF v_tmp_count > 0 THEN
        v_tenant_count := v_tmp_count;
        v_tenant_name  := v_tmp_name;
      END IF;
    END IF;

  ELSIF p_entity_type = 'tenant' THEN
    SELECT COUNT(*), MIN(first_name || ' ' || last_name)
    INTO v_tenant_count, v_tenant_name
    FROM tenants WHERE id = p_entity_id;
  END IF;

  RETURN jsonb_build_object(
    'has_tenant',    v_tenant_count > 0,
    'tenant_name',   v_tenant_name,
    'tenant_count',  v_tenant_count
  );
END;
$$;

-- ============================================================
-- archive_and_delete_property
-- Order: archive sub_units → units → tenants → property
--        then delete links → tenants → property (cascades units+sub_units)
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_and_delete_property(
  p_property_id UUID,
  p_deleted_by  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Archive sub_units (must happen before cascade wipes them)
  INSERT INTO archive_sub_units (
    id, unit_id, name, type, rent_price, area, availability_date,
    photos, amenities, shared_spaces, tenant_id, tenant_name,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    su.id, su.unit_id, su.name, su.type, su.rent_price, su.area, su.availability_date,
    su.photos, su.amenities, su.shared_spaces, su.tenant_id, su.tenant_name,
    su.created_at, su.updated_at, NOW(), p_deleted_by
  FROM sub_units su
  JOIN units u ON su.unit_id = u.id
  WHERE u.property_id = p_property_id;

  -- 2. Archive units
  INSERT INTO archive_units (
    id, property_id, name, description, unit_type, bedrooms, bathrooms, area,
    rent_entire_unit, default_rent_price, availability_date, lease_start_date,
    lease_end_date, photos, amenities, tenant_id, is_occupied,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, property_id, name, description, unit_type, bedrooms, bathrooms, area,
    rent_entire_unit, default_rent_price, availability_date, lease_start_date,
    lease_end_date, photos, amenities, tenant_id, is_occupied,
    created_at, updated_at, NOW(), p_deleted_by
  FROM units
  WHERE property_id = p_property_id;

  -- 3. Archive tenants linked to this property
  INSERT INTO archive_tenants (
    id, user_id, first_name, last_name, email, phone, property_id, unit_id,
    unit_name, photo, start_date, end_date, rent_amount, status, payments,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, user_id, first_name, last_name, email, phone, property_id, unit_id,
    unit_name, photo, start_date, end_date, rent_amount, status, payments,
    created_at, updated_at, NOW(), p_deleted_by
  FROM tenants
  WHERE property_id::TEXT = p_property_id::TEXT;

  -- 4. Archive property
  INSERT INTO archive_properties (
    id, user_id, name, address1, address2, city, state, zip_code, country,
    property_type, landlord_name, rent_complete_property, description, photos,
    parking_included, rent_amount, utilities, status,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, user_id, name, address1, address2, city, state, zip_code, country,
    property_type, landlord_name, rent_complete_property, description, photos,
    parking_included, rent_amount, utilities, status,
    created_at, updated_at, NOW(), p_deleted_by
  FROM properties
  WHERE id = p_property_id;

  -- 5. Delete all tenant_property_links for this property
  DELETE FROM tenant_property_links WHERE property_id::TEXT = p_property_id::TEXT;

  -- 6. Delete tenants (cast both sides to handle UUID or TEXT column)
  DELETE FROM tenants WHERE property_id::TEXT = p_property_id::TEXT;

  -- 7. Delete property → cascades to units + sub_units automatically
  DELETE FROM properties WHERE id = p_property_id;

END;
$$;

-- ============================================================
-- archive_and_delete_unit
-- Order: archive sub_units → tenants → unit
--        then delete links → tenants → unit (cascades sub_units)
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_and_delete_unit(
  p_unit_id    UUID,
  p_deleted_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Archive sub_units of this unit
  INSERT INTO archive_sub_units (
    id, unit_id, name, type, rent_price, area, availability_date,
    photos, amenities, shared_spaces, tenant_id, tenant_name,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, unit_id, name, type, rent_price, area, availability_date,
    photos, amenities, shared_spaces, tenant_id, tenant_name,
    created_at, updated_at, NOW(), p_deleted_by
  FROM sub_units
  WHERE unit_id = p_unit_id;

  -- 2. Archive tenants linked to this unit
  INSERT INTO archive_tenants (
    id, user_id, first_name, last_name, email, phone, property_id, unit_id,
    unit_name, photo, start_date, end_date, rent_amount, status, payments,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, user_id, first_name, last_name, email, phone, property_id, unit_id,
    unit_name, photo, start_date, end_date, rent_amount, status, payments,
    created_at, updated_at, NOW(), p_deleted_by
  FROM tenants
  WHERE unit_id = p_unit_id::TEXT;

  -- 3. Archive the unit itself
  INSERT INTO archive_units (
    id, property_id, name, description, unit_type, bedrooms, bathrooms, area,
    rent_entire_unit, default_rent_price, availability_date, lease_start_date,
    lease_end_date, photos, amenities, tenant_id, is_occupied,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, property_id, name, description, unit_type, bedrooms, bathrooms, area,
    rent_entire_unit, default_rent_price, availability_date, lease_start_date,
    lease_end_date, photos, amenities, tenant_id, is_occupied,
    created_at, updated_at, NOW(), p_deleted_by
  FROM units
  WHERE id = p_unit_id;

  -- 4. Delete all tenant_property_links for this unit (covers sub-unit links too)
  DELETE FROM tenant_property_links WHERE unit_id = p_unit_id;

  -- 5. Delete tenants linked to this unit (text FK)
  DELETE FROM tenants WHERE unit_id = p_unit_id::TEXT;

  -- 6. Delete unit → cascades to sub_units
  DELETE FROM units WHERE id = p_unit_id;

END;
$$;

-- ============================================================
-- archive_and_delete_subunit
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_and_delete_subunit(
  p_subunit_id UUID,
  p_deleted_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Archive the sub_unit
  INSERT INTO archive_sub_units (
    id, unit_id, name, type, rent_price, area, availability_date,
    photos, amenities, shared_spaces, tenant_id, tenant_name,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, unit_id, name, type, rent_price, area, availability_date,
    photos, amenities, shared_spaces, tenant_id, tenant_name,
    created_at, updated_at, NOW(), p_deleted_by
  FROM sub_units
  WHERE id = p_subunit_id;

  -- 2. Delete tenant_property_links pointing to this sub_unit
  DELETE FROM tenant_property_links WHERE sub_unit_id = p_subunit_id;

  -- 3. Delete the sub_unit
  DELETE FROM sub_units WHERE id = p_subunit_id;
END;
$$;

-- ============================================================
-- archive_and_delete_tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_and_delete_tenant(
  p_tenant_id  UUID,
  p_deleted_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Archive the tenant
  INSERT INTO archive_tenants (
    id, user_id, first_name, last_name, email, phone, property_id, unit_id,
    unit_name, photo, start_date, end_date, rent_amount, status, payments,
    created_at, updated_at, deleted_at, deleted_by
  )
  SELECT
    id, user_id, first_name, last_name, email, phone, property_id, unit_id,
    unit_name, photo, start_date, end_date, rent_amount, status, payments,
    created_at, updated_at, NOW(), p_deleted_by
  FROM tenants
  WHERE id = p_tenant_id;

  -- 2. Clear sub_units.tenant_id / tenant_name where this tenant was assigned inline
  UPDATE sub_units
  SET tenant_id = NULL, tenant_name = NULL, updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- 3. Delete all tenant_property_links for this tenant
  DELETE FROM tenant_property_links WHERE tenant_id = p_tenant_id;

  -- 4. Delete the tenant record
  DELETE FROM tenants WHERE id = p_tenant_id;
END;
$$;
