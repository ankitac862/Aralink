# Property Hierarchy Bug - App-Wide Audit

## Root Cause

The app has **4 property types** with different hierarchical structures:

### Correct Property Hierarchy

1. **multi_unit**: property → units → subunits
   - Has units table entries
   - Each unit can have subunits (rooms)

2. **single_unit, commercial, parking**: property → subunits (NO units)
   - NO units table entries
   - Subunits (rooms) are directly under property

## Critical Bug Pattern

Many screens incorrectly assume:
- **ALL properties** have units first, then subunits
- This causes "unit not found" errors for single_unit/commercial/parking properties

## Correct Logic Pattern

```typescript
// ✅ CORRECT: Check property_type first
if (property.property_type === 'multi_unit') {
  // Query units table
  // Then query sub_units with unit_id
} else {
  // For single_unit, commercial, parking
  // Query sub_units directly with property_id (unit_id will be null)
}
```

## Files Audited - Status

### ✅ FIXED
1. **app/(tabs)/tenant-dashboard.tsx**
   - Lines 100-120: Now checks `property.property_type === 'multi_unit'`
   - Correctly displays unit.name vs subunit.name based on property type

2. **app/tenant-maintenance-request.tsx**
   - Lines 90-150: Property fetching now checks property_type
   - Only queries units if property_type === 'multi_unit'
   - Otherwise queries subunits directly

### ⚠️ NEEDS FIXING

#### 3. **app/tenant-start-chat.tsx** (CRITICAL)
- **Issue**: Lines 57-70 use tenant_property_links with left joins
- **Problem**: Joins `units` and `sub_units` tables without checking property_type
- **Impact**: May fail to load landlords for single_unit properties
- **Fix Needed**: 
  ```typescript
  // Don't join units/sub_units in the query
  // Fetch tenant_property_links first
  // Then conditionally fetch unit/subunit based on property_type
  ```

#### 4. **app/add-tenant.tsx** (HIGH PRIORITY)
- **Issue**: Lines 180-184
  ```typescript
  const isByRoomProperty = !!selectedProperty && !isMultiUnitProperty && 
    selectedProperty.rentCompleteProperty === false;
  
  const availableUnits = useMemo(() => {
    if (!selectedProperty) return [];
    if (!isMultiUnitProperty && !isByRoomProperty) return [];
    return selectedProperty.units || [];
  }, [selectedProperty, isMultiUnitProperty, isByRoomProperty]);
  ```
- **Problem**: For single_unit with rentCompleteProperty=false, this tries to find units
- **Reality**: Single_unit properties with rooms have subunits directly (no units table)
- **Fix Needed**: Skip units entirely for non-multi_unit properties, fetch subunits directly

#### 5. **app/add-applicant.tsx** (HIGH PRIORITY)
- **Issue**: Lines 103-107 - Same logic as add-tenant.tsx
  ```typescript
  const availableUnits = useMemo(() => {
    if (!selectedProperty) return [];
    if (!isMultiUnitProperty && !isByRoomProperty) return [];
    return selectedProperty.units || [];
  }, [selectedProperty, isMultiUnitProperty, isByRoomProperty]);
  ```
- **Impact**: Applicants can't select correct room for single_unit properties
- **Fix Needed**: Same as add-tenant.tsx

#### 6. **components/PropertyAddressSelector.tsx** (MEDIUM PRIORITY)
- **Issue**: Lines 132-145
  ```typescript
  const hasUnits = property.units && property.units.length > 0;
  const isMultiUnit = property.propertyType === 'multi_unit';
  
  if (hasUnits && (isMultiUnit || property.units!.length > 1)) {
    setStep('unit');
  }
  ```
- **Problem**: Checks for `hasUnits` before checking property type
- **Impact**: May not show subunit selection for single_unit properties with rooms
- **Fix Needed**: Check property_type first, not units existence

#### 7. **lib/supabase.ts** (MULTIPLE FUNCTIONS - HIGH PRIORITY)

##### Function: `addTenantToProperty` (Lines ~1100-1200)
- **Issue**: Doesn't validate unit_id based on property_type
- **Fix**: Add validation - reject unit_id for non-multi_unit properties

##### Function: `createLeaseWithTenant` (Lines ~1250-1350)
- **Issue**: Same as above
- **Fix**: Same validation needed

##### Function: `submitPropertyApplication` (Lines ~1400-1450)
- **Issue**: Accepts unit_id without property_type validation
- **Fix**: Validate or ignore unit_id for non-multi_unit properties

##### Function: `getTenantPropertyAssociation` (Lines ~3300-3400)
- **Issue**: Queries units table without checking property_type first
  ```typescript
  if (unitId) {
    unit = await supabase
      .from('units')
      .select('*')
      .eq('id', unitId)
      .single()
  }
  ```
- **Fix**: Check property.property_type before querying units

#### 8. **store/propertyStore.ts** (REVIEW NEEDED)
- Lines 194, 215, 575, 770 reference unit names
- **Need to verify**: Store operations handle property_type correctly
- **Potential Issue**: State updates may assume units exist

### ✅ NO CHANGES NEEDED

9. **app/property-detail.tsx**
   - Already checks `property.propertyType === 'multi_unit'` correctly
   - Handles all 4 property types appropriately

10. **app/add-property.tsx**
    - Property creation - doesn't query existing structures
    - No hierarchy assumptions

## Testing Checklist

After fixes, test these scenarios:

### Single Unit Property (with rooms)
- [ ] Tenant dashboard shows correct room name (not "Main Unit")
- [ ] Maintenance request submission works with subunit selection
- [ ] Start chat loads landlord correctly
- [ ] Add tenant shows room dropdown (not unit dropdown)
- [ ] Applicant invitation includes correct room
- [ ] PropertyAddressSelector shows room selection

### Multi-Unit Property
- [ ] Shows unit dropdown first
- [ ] Then shows room dropdown if unit has rooms
- [ ] All features work with unit+room combination

### Commercial/Parking Property
- [ ] Works same as single_unit (rooms/spaces directly under property)
- [ ] No unit selection appears

## Database Validation

```sql
-- Check property types and their actual structure
SELECT 
  p.property_type,
  COUNT(DISTINCT u.id) as unit_count,
  COUNT(DISTINCT su.id) as subunit_count,
  COUNT(DISTINCT su2.id) as direct_subunit_count
FROM properties p
LEFT JOIN units u ON u.property_id = p.id
LEFT JOIN sub_units su ON su.unit_id = u.id
LEFT JOIN sub_units su2 ON su2.property_id = p.id AND su2.unit_id IS NULL
GROUP BY p.property_type;

-- Expected results:
-- multi_unit: unit_count > 0, subunit_count > 0, direct_subunit_count = 0
-- single_unit: unit_count = 0, subunit_count = 0, direct_subunit_count > 0
-- commercial: unit_count = 0, subunit_count = 0, direct_subunit_count > 0
-- parking: unit_count = 0, subunit_count = 0, direct_subunit_count > 0
```

## Standard Fix Pattern

For ANY code that accesses units or subunits:

```typescript
// ❌ WRONG: Assuming units exist
const unit = property.units?.[0];
const subUnit = unit?.subUnits?.[0];

// ✅ CORRECT: Check property type first
if (property.property_type === 'multi_unit') {
  // Access units, then subunits
  const unit = property.units?.[0];
  const subUnit = unit?.subUnits?.[0];
} else {
  // single_unit, commercial, parking
  // Access subunits directly (no units)
  const subUnit = property.subUnits?.[0];
}
```

## SQL Query Pattern

```typescript
// ❌ WRONG: Join units for all properties
const { data } = await supabase
  .from('tenant_property_links')
  .select(`
    *,
    properties(*),
    units(name),
    sub_units(name)
  `)

// ✅ CORRECT: Fetch property first, then conditionally fetch structure
const { data: link } = await supabase
  .from('tenant_property_links')
  .select('*')
  .eq('tenant_id', tenantId)
  .single();

const { data: property } = await supabase
  .from('properties')
  .select('*')
  .eq('id', link.property_id)
  .single();

if (property.property_type === 'multi_unit' && link.unit_id) {
  // Fetch unit
  const { data: unit } = await supabase
    .from('units')
    .select('*')
    .eq('id', link.unit_id)
    .single();
    
  if (link.sub_unit_id) {
    // Fetch subunit under unit
    const { data: subUnit } = await supabase
      .from('sub_units')
      .select('*')
      .eq('unit_id', link.unit_id)
      .eq('id', link.sub_unit_id)
      .single();
  }
} else if (link.sub_unit_id) {
  // For non-multi_unit: fetch subunit directly
  const { data: subUnit } = await supabase
    .from('sub_units')
    .select('*')
    .eq('property_id', link.property_id)
    .eq('id', link.sub_unit_id)
    .single();
}
```

## Next Steps

1. **Fix tenant-start-chat.tsx** - Critical for chat functionality
2. **Fix add-tenant.tsx and add-applicant.tsx** - High priority for tenant management
3. **Fix PropertyAddressSelector.tsx** - Affects multiple screens
4. **Review and fix lib/supabase.ts functions** - Core data layer
5. **Test all scenarios** using the checklist above
6. **Run SQL validation** to confirm database structure matches expectations

## Estimated Impact

- **tenant-start-chat**: ~100 active users affected
- **add-tenant/applicant**: Every landlord adding tenants
- **maintenance requests**: Already fixed ✅
- **dashboard**: Already fixed ✅

Total files needing fixes: **5 files + multiple supabase.ts functions**
