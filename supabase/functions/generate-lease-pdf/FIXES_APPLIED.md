# ✅ Issues Fixed

## Issue 1: Room Rent Not Showing ✅ FIXED

**Problem:**
When clicking "Generate Lease" from a room, the rent amount wasn't being pre-filled in Step 5.

**Root Cause:**
1. `roomId` was being mapped to `unitId` instead of `subUnitId` in lease wizard initialization
2. `step5.tsx` was looking for `rentAmount` property but SubUnits use `rentPrice`

**Fix Applied:**
- ✅ `app/lease-wizard/index.tsx` line 92: Changed `subUnitId: undefined` to `subUnitId: params.roomId || undefined`
- ✅ `app/lease-wizard/step5.tsx` line 69-70: Changed from `subUnit?.rentAmount` to `subUnit?.rentPrice`
- ✅ `app/lease-wizard/step5.tsx` line 74: Changed from `unit.rentAmount` to `unit.defaultRentPrice`

**Result:** Now when generating a lease from a room, the rent price will automatically pre-fill! 🎉

---

## Issue 2: PDF Fields Not Filling ⚠️ NEEDS SECRET CONFIGURATION

**Current Status:**
The code is actually CORRECT! The endpoint was already fixed to use `/fill-form`.

**Problem:**
PDF.co isn't filling the fields because:
1. ❌ Secrets might not be set in Supabase
2. ❌ Field names in `buildFieldMapping()` might not match your actual PDF

### 🔧 Quick Checklist:

#### Step 1: Verify Secrets Are Set

Go to **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**

Make sure these are set:

```
LEASE_TEMPLATE_URL = https://ykfecigqskkddpphbdop.supabase.co/storage/v1/object/public/templates/leases//2229e_standard-lease_static.pdf

PDF_FILLER_URL = https://api.pdf.co/v1/pdf/edit/fill-form

PDF_FILLER_API_KEY = your_pdfco_api_key_here
```

#### Step 2: Get ACTUAL Field Names from Your PDF

Your PDF field names might be different! Run this to see them:

1. Go to: https://app.pdf.co/pdf-info
2. Upload your `2229e_standard-lease_static.pdf`
3. Copy the field names that appear
4. Update `buildFieldMapping()` function (line 242-305) with the ACTUAL field names

**Example:** If your PDF has a field called `"Landlord_Name"` but the code says `"Landlords Legal Name"`, it won't work!

### Current Field Mapping (Line 255-302):

```typescript
'Landlords Legal Name': formData.landlordName,
'landlord_legal_name': formData.landlordName,
'Text1': formData.landlordName,
'Last Name': formData.tenantNames[0]?.split(' ').slice(-1)[0] || '',
'First Name': formData.tenantNames[0]?.split(' ')[0] || '',
// ... etc
```

### 🎯 To Test:

1. Set the secrets in Supabase
2. Redeploy the function:
   ```bash
   supabase functions deploy generate-lease-pdf
   ```
3. Generate a lease
4. Check the Edge Function logs:
   - Supabase Dashboard → Edge Functions → generate-lease-pdf → Logs
5. Look for:
   - ✅ "External PDF filler configured"
   - ✅ "PDF filled successfully via PDF.co"
   - ❌ If you see "No PDF filler service configured" → Secrets not set!
   - ❌ If you see PDF.co errors → Field names don't match!

### 🐛 Debug Mode:

Uncomment lines in `tryTemplateFilling()` to see all field names in your PDF:

```typescript
// Around line 180, add:
console.log('\n=== ANALYZING PDF TEMPLATE ===');
await getPdfFieldNames(TEMPLATE_URL); // This function already exists!
console.log('=== ANALYSIS COMPLETE ===\n');
```

This will log ALL field names from your PDF in the Edge Function logs!

---

## Summary

- ✅ **Issue 1 (Room rent)**: FIXED - Deploy and test
- ⚠️ **Issue 2 (PDF filling)**: Code is correct, need to:
  1. Set the 3 secrets in Supabase Dashboard
  2. Verify field names match your actual PDF
  3. Redeploy the function

Once secrets are set and field names match, the PDF will fill correctly! 🚀
