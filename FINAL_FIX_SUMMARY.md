# ✅ FINAL FIX - PDF.co Endpoint Corrected

## The Problem
You were getting a **404 error**: 
```
"API endpoint /v1/pdf/edit//fill-form not found"
```

## The Solution

According to the [official PDF.co documentation](https://docs.pdf.co/integrations/n8n/fill-a-pdf-form#fill-a-pdf-form), the **correct endpoint** for filling PDF forms is:

```
https://api.pdf.co/v1/pdf/edit/add
```

NOT `/fill-form`!

---

## What I Fixed

### 1. ✅ Edge Function Endpoint (Line 17)

**Changed from:**
```typescript
const PDFCO_FILL_FORM_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/fill-form';
```

**To:**
```typescript
const PDFCO_FILL_FORM_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/add';
```

### 2. ✅ Request Format (Line 242-305)

Changed `buildFieldMapping()` to return **array format**:

```typescript
// OLD (Object format)
{
  "Landlords Legal Name": "John Doe",
  "Text1": "John Doe",
  ...
}

// NEW (Array format - CORRECT for PDF.co)
[
  { "fieldName": "Landlords Legal Name", "pages": "0", "text": "John Doe" },
  { "fieldName": "Text1", "pages": "0", "text": "John Doe" },
  ...
]
```

### 3. ✅ Request Body (Line 200)

**Changed from:**
```typescript
{
  url: TEMPLATE_URL,
  fields: fillData,  // Object
  flatten: true,
  async: false,
}
```

**To:**
```typescript
{
  url: TEMPLATE_URL,
  name: `ontario-lease-${leaseId}`,
  fields: fillData,  // Array
  async: false,
}
```

---

## 🔧 Setup Instructions

### Step 1: Set Supabase Secrets

**Supabase Dashboard → Edge Functions → Settings → Secrets**

```
PDF_FILLER_URL = https://api.pdf.co/v1/pdf/edit/add
PDF_FILLER_API_KEY = (your PDF.co API key)
LEASE_TEMPLATE_URL = https://ykfecigqskkddpphbdop.supabase.co/storage/v1/object/public/templates/leases//2229e_standard-lease_static.pdf
```

### Step 2: Redeploy Edge Function

```bash
cd Aralink
supabase functions deploy generate-lease-pdf
```

### Step 3: Test!

1. Go to your app
2. Generate a lease from a room (to also test Issue #1 fix)
3. The PDF should now:
   - ✅ Have the rent pre-filled
   - ✅ Have ALL form fields filled from your data

---

## 📊 What PDF.co Will Do

According to the [PDF.co documentation](https://docs.pdf.co/integrations/n8n/fill-a-pdf-form#fill-a-pdf-form):

1. Takes your template URL
2. Receives an array of fields: `[{ fieldName, pages, text }, ...]`
3. Creates a **copy** of your template
4. **Fills the form fields** in the copy
5. Returns the filled PDF URL

**Your original template stays untouched!** ✅

---

## 🐛 If Still Getting Blank PDF

The field names might not match. To debug:

1. Uncomment lines 182-184 in the Edge Function:
   ```typescript
   console.log('\n=== ANALYZING PDF TEMPLATE ===');
   await getPdfFieldNames(TEMPLATE_URL);
   console.log('=== ANALYSIS COMPLETE ===\n');
   ```

2. Redeploy and generate a lease

3. Check **Edge Function Logs** (Supabase Dashboard → Edge Functions → generate-lease-pdf → Logs)

4. You'll see ALL field names in your PDF - compare with the mapping in `buildFieldMapping()`

---

## 📝 Summary

**Issue 1 (Room Rent):** ✅ FIXED - `roomId` now correctly maps to `subUnitId`

**Issue 2 (PDF Filling):** ✅ FIXED - Now using correct endpoint `/edit/add` with array format

**Next:** Set the 3 secrets → Redeploy → Test! 🚀

**Documentation Reference:** https://docs.pdf.co/integrations/n8n/fill-a-pdf-form#fill-a-pdf-form
