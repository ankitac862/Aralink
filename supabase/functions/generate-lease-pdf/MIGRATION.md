# Lease Generation Module - Migration Summary

## What Changed

This document summarizes the changes made to migrate from the existing lease generation system to PDF.co-based generation.

## Overview

**Before**: Mixed XFA/template filling approach with HTML fallback
**After**: Clean PDF.co-based solution using text annotations and signature fields

## Key Changes

### 1. Data Structure (Breaking Changes)

The `OntarioLeaseFormData` interface has been completely restructured to match your requirements:

#### Old Structure
```typescript
{
  landlordName: string;
  tenantNames: string[];
  unitAddress: {...};
  tenancyStartDate: string;
  baseRent: number;
  // ... flat structure
}
```

#### New Structure
```typescript
{
  landlords: [{ legalName: string }];  // Up to 4
  tenants: [{ firstName: string; lastName: string }];  // Up to 12
  rentalUnit: {...};
  contact: {...};
  term: {...};
  rent: {...};
  services: {...};
  utilities: {...};
  deposits: {...};
  smoking: {...};
  insurance: {...};
  additionalTerms: {...};
}
```

### 2. Edge Function (`generate-lease-pdf/index.ts`)

**Removed**:
- Old XFA template filling logic
- HTML-to-PDF conversion fallback
- Complex field mapping with 100+ field names
- External PDF generator integration

**Added**:
- Clean PDF.co integration
- `buildPdfCoAnnotations()` - Creates text overlays for Sections 1-15
- `buildSignatureFields()` - Creates editable signature fields for Section 17
- Helper functions: `checkbox()`, `formatDate()`, `formatCurrency()`
- Simplified error handling with clear error codes

**File size**: Reduced from ~2000 lines to ~1200 lines

### 3. Client Service (`lease-generation-service.ts`)

**No changes required** to the service file itself, but:

- Response type `engineUsed` now returns `'pdfco'` instead of `'xfa'` or `'template'`
- Form data validation will need to be updated to match new structure

### 4. Environment Variables

**Old**:
```bash
LEASE_TEMPLATE_URL
PDF_GENERATOR_URL (optional)
PDF_GENERATOR_API_KEY (optional)
PDF_FILLER_URL (optional)
PDF_FILLER_API_KEY (optional)
```

**New**:
```bash
PDFCO_API_KEY (required)
LEASE_TEMPLATE_URL (required)
```

## Migration Steps

### For Developers

1. **Update Client Code**

If you have existing code that builds `OntarioLeaseFormData`, update it:

```typescript
// OLD
const formData = {
  landlordName: "John Smith",
  tenantNames: ["Alice Johnson"],
  unitAddress: {...},
  tenancyStartDate: "2026-02-01",
  baseRent: 2000,
  // ...
};

// NEW
const formData = {
  landlords: [{ legalName: "John Smith" }],
  tenants: [{ firstName: "Alice", lastName: "Johnson" }],
  rentalUnit: {...},
  term: {
    startDate: "2026-02-01",
    type: "fixed",
    endDate: "2027-02-01"
  },
  rent: {
    base: 2000,
    total: 2000,
    dueDay: 1,
    frequency: "monthly",
    payableTo: "John Smith",
    paymentMethods: ["e-transfer"]
  },
  // ...
};
```

2. **Update Type Imports**

The type is still named `OntarioLeaseFormData` but has a different structure:

```typescript
import type { OntarioLeaseFormData } from '@/lib/supabase';
```

3. **Update Validation Logic**

In `lease-generation-service.ts`, the `validateFormData()` function needs updating:

```typescript
function validateFormData(formData: OntarioLeaseFormData): string | null {
  // OLD
  if (!formData.landlordName?.trim()) {
    return 'Landlord name is required';
  }
  
  // NEW
  if (!formData.landlords?.length || !formData.landlords[0]?.legalName?.trim()) {
    return 'At least one landlord is required';
  }
  
  // Update other validations similarly...
}
```

4. **Deploy Edge Function**

```bash
cd Aralink
supabase secrets set PDFCO_API_KEY=your_key
supabase secrets set LEASE_TEMPLATE_URL=your_template_url
supabase functions deploy generate-lease-pdf
```

### For End Users

**No changes** - The UI should abstract these changes. Users will continue to:
1. Fill out the lease form
2. Click "Generate PDF"
3. Receive a PDF with editable signature fields

## Benefits of New System

### ✅ Advantages

1. **Simpler Architecture**
   - One PDF generation method (PDF.co)
   - No fallback complexity
   - Easier to maintain

2. **Better Scalability**
   - Supports up to 4 landlords (was 1)
   - Supports up to 12 tenants (was 14, but more practical layout)
   - Cleaner data structure

3. **Editable Signatures**
   - True signature fields (not just text overlays)
   - Can be signed electronically
   - Compliant with e-signature standards

4. **Better Checkboxes**
   - Visual checkboxes: ☑ (checked) vs ☐ (unchecked)
   - More professional appearance

5. **Easier Customization**
   - All field positions in one function
   - Clear documentation for adjustments
   - No need to reverse-engineer field names

### ⚠️ Considerations

1. **External Dependency**
   - Requires PDF.co subscription
   - Free tier: 100 PDFs/month
   - Cost scales with usage

2. **Template Positioning**
   - May need to adjust X/Y coordinates for your specific template
   - See `FIELD_POSITIONS.md` for guidance

3. **Breaking Changes**
   - Data structure is completely different
   - Existing code that builds form data must be updated

## Testing Checklist

Before deploying to production:

- [ ] Configure PDF.co API key
- [ ] Upload and configure template URL
- [ ] Deploy edge function
- [ ] Update client code to new data structure
- [ ] Test with 1 landlord, 1 tenant
- [ ] Test with 4 landlords, 12 tenants
- [ ] Test with all optional fields populated
- [ ] Test with minimal required fields only
- [ ] Verify checkboxes render correctly
- [ ] Verify signature fields are editable
- [ ] Verify PDF is exactly 7 pages
- [ ] Test error handling (invalid API key, bad data, etc.)
- [ ] Check storage bucket permissions
- [ ] Verify PDF download works

## Files Changed

### Modified
- `Aralink/supabase/functions/generate-lease-pdf/index.ts` - Complete rewrite

### New
- `Aralink/supabase/functions/generate-lease-pdf/README.md` - Documentation
- `Aralink/supabase/functions/generate-lease-pdf/DEPLOYMENT.md` - Deployment guide
- `Aralink/supabase/functions/generate-lease-pdf/FIELD_POSITIONS.md` - Position config
- `Aralink/supabase/functions/generate-lease-pdf/MIGRATION.md` - This file

### To Update (by you)
- `Aralink/lib/supabase.ts` - Update `OntarioLeaseFormData` interface
- `Aralink/services/lease-generation-service.ts` - Update `validateFormData()`
- Any UI components that build form data
- Any components that display lease information

## Rollback Plan

If you need to rollback:

1. **Keep old function code** (save a copy before deploying)
2. **Use git** to restore previous version
3. **Redeploy** old function:
   ```bash
   git checkout HEAD~1 -- Aralink/supabase/functions/generate-lease-pdf/
   supabase functions deploy generate-lease-pdf
   ```

## Support Resources

- **PDF.co Docs**: https://docs.pdf.co/
- **PDF.co Support**: support@pdf.co
- **This Documentation**: See README.md, DEPLOYMENT.md, FIELD_POSITIONS.md

## Next Steps

1. ✅ Edge function updated
2. ⬜ Update type definitions in `lib/supabase.ts`
3. ⬜ Update validation in `lease-generation-service.ts`
4. ⬜ Update UI components to use new data structure
5. ⬜ Test with PDF.co sandbox
6. ⬜ Adjust field positions for your template
7. ⬜ Deploy to production
8. ⬜ Monitor PDF.co usage and costs

---

**Questions?** Review the README.md for detailed usage instructions or FIELD_POSITIONS.md for positioning guidance.
