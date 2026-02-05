# Quick Fix: Storage Bucket Setup

## Problem
- ❌ "Bucket not found" error when viewing/downloading PDFs
- ⚠️ XFA template not working (falling back to standard PDF)

## Solution

### Step 1: Create Storage Bucket (REQUIRED)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Storage** in sidebar
4. Click **New bucket**
5. Settings:
   - Name: `lease-documents`
   - Public: **OFF**
   - File size limit: `10` MB
   - Allowed MIME types: `application/pdf`
6. Click **Create bucket**

### Step 2: Set Storage Policies (REQUIRED)

Go to **SQL Editor** and run:

```sql
-- Allow users to upload lease documents
CREATE POLICY "Users can upload lease documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to read their documents
CREATE POLICY "Users can read their lease documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their documents
CREATE POLICY "Users can delete their lease documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

### Step 3: Upload Ontario Lease Template (OPTIONAL)

If you want to use the official Ontario lease PDF template:

#### Option A: Public Templates Bucket

1. Go to **Storage** → **New bucket**
2. Settings:
   - Name: `templates`
   - Public: **ON** ✅
   - File size limit: `10` MB
3. Create bucket
4. Upload your PDF: `ontario-standard-lease-fillable.pdf`
5. Copy the public URL (should look like):
   ```
   https://[PROJECT-ID].supabase.co/storage/v1/object/public/templates/ontario-standard-lease-fillable.pdf
   ```

#### Option B: Use Signed URL (Your Current Setup)

1. Go to **Edge Functions** → `generate-lease-pdf`
2. Click **Secrets** tab
3. Add secret:
   - Key: `LEASE_TEMPLATE_URL`
   - Value: 
   ```
   https://ykfecigqskkddpphbdop.supabase.co/storage/v1/object/sign/lease-documents/leases/templates/ontario-standard-lease-fillable.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85NWRkYTg4ZC1hZGI2LTQxZDItOTdlMi0wZDQ3NDdlNGQwYmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsZWFzZS1kb2N1bWVudHMvbGVhc2VzL3RlbXBsYXRlcy9vbnRhcmlvLXN0YW5kYXJkLWxlYXNlLWZpbGxhYmxlLnBkZiIsImlhdCI6MTc2ODI0NDk5NCwiZXhwIjoyMDgzNjA0OTk0fQ.1r4ueVSaNyFgMnxAai_Kg6QEeC6r16HvN-iUZnLZjQo
   ```
4. Save and redeploy function

### Step 4: Test

1. Go to your app
2. Navigate to a property
3. Click "Generate Lease"
4. Fill the wizard
5. Click "Generate"
6. ✅ Should generate without errors
7. Click "View" or "Download"
8. ✅ Should open/download the PDF

## Expected Results

After Step 1 & 2:
- ✅ PDF generation works
- ✅ View/Download works
- ⚠️ Uses fallback HTML-to-PDF (still valid Ontario lease)

After Step 3:
- ✅ PDF generation works
- ✅ View/Download works
- ✅ Uses official Ontario PDF template (if XFA engine available)
- ⚠️ Or falls back to HTML (if XFA not available)

## Why XFA Might Still Fail

The Ontario Standard Lease PDF is an **XFA (XML Forms Architecture)** document, which requires:
- Adobe PDF Services API (paid) OR
- Apryse/PDFTron SDK (paid) OR
- Other commercial XFA engine

Without an XFA engine:
- ✅ Fallback HTML-to-PDF generation still works
- ✅ Generated PDF contains all sections
- ✅ Legally valid Ontario Standard Lease
- ❌ Not the exact official template design

To use the exact official template, you'd need to:
1. Sign up for Adobe PDF Services: https://developer.adobe.com/document-services/
2. Get API credentials
3. Add to Edge Function secrets:
   ```
   XFA_ENGINE_URL=https://pdf-services.adobe.io
   XFA_ENGINE_API_KEY=your_api_key
   ```

But the fallback works fine for now!
