# Fix: Private Bucket Access Issue

## Problem

✅ **Lease PDF is being generated successfully** (you have the file)  
❌ **But accessing from app shows "Bucket not found" error**

## Root Cause

The `lease-documents` bucket is **private** (correct for security), but the code was using `getPublicUrl()` which doesn't work with private buckets.

### What's Happening

```
Edge Function generates PDF ✅
    ↓
Uploads to lease-documents bucket ✅
    ↓
Calls getPublicUrl() to get URL ❌
    ↓
Returns public URL to app
    ↓
App tries to access public URL ❌
    ↓
Error: "Bucket not found" (because bucket is private!)
```

---

## ✅ Solution Applied

### Code Fix: Use Signed URLs

**Changed in:** `supabase/functions/generate-lease-pdf/index.ts`

```typescript
// ❌ BEFORE (doesn't work for private buckets):
const { data: urlData } = supabase.storage
  .from('lease-documents')
  .getPublicUrl(storagePath);

const documentUrl = urlData.publicUrl;
```

```typescript
// ✅ AFTER (works for private buckets):
const { data: urlData, error: urlError } = await supabase.storage
  .from('lease-documents')
  .createSignedUrl(storagePath, 31536000); // 1 year validity

if (urlError) {
  return { success: false, error: urlError.message };
}

const documentUrl = urlData.signedUrl;
```

### What is a Signed URL?

A **signed URL** is a temporary, authenticated URL that:
- ✅ Works with private buckets
- ✅ Bypasses RLS policies
- ✅ Has an expiration time (we set 1 year)
- ✅ Includes authentication token in the URL
- ✅ More secure than public URLs

**Example:**
```
https://project.supabase.co/storage/v1/object/sign/lease-documents/leases/user-123/lease-456.pdf?token=eyJhbGc...
```

---

## 🔐 Required: Storage Policies for Service Role

The Edge Function uses the **service_role** key, which needs permission to access the bucket.

### Add These Policies in Supabase Dashboard

**Go to:** Storage → lease-documents → Policies → New Policy

#### Policy 1: Allow Service Role to Upload

```sql
CREATE POLICY "Allow service role to upload"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'lease-documents');
```

**Via Dashboard:**
- Policy name: `Allow service role to upload`
- Target roles: `service_role`
- Allowed operation: `INSERT`
- WITH CHECK expression: `bucket_id = 'lease-documents'`

#### Policy 2: Allow Service Role to Read

```sql
CREATE POLICY "Allow service role to read"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'lease-documents');
```

**Via Dashboard:**
- Policy name: `Allow service role to read`
- Target roles: `service_role`
- Allowed operation: `SELECT`
- USING expression: `bucket_id = 'lease-documents'`

#### Policy 3: Keep Existing User Policies

Keep your existing policies for authenticated users:

```sql
-- Users can read their own leases
CREATE POLICY "Users can read own leases"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can upload to their own folder
CREATE POLICY "Users can upload own leases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

---

## 🔧 Complete Fix Steps

### Step 1: Add Service Role Policies

**Option A: Via Dashboard (Easier)**

1. Go to **Supabase Dashboard** → **Storage**
2. Click on **`lease-documents`** bucket
3. Go to **Policies** tab
4. Click **New policy**
5. Create **2 policies** (one for SELECT, one for INSERT) as shown above

**Option B: Via SQL Editor**

1. Go to **SQL Editor**
2. Run this:

```sql
-- Allow service role to upload and read
CREATE POLICY "service_role_insert"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'lease-documents');

CREATE POLICY "service_role_select"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'lease-documents');
```

### Step 2: Redeploy Edge Function

```bash
cd "/Users/ankitac862/Documents/ANKITA /FProject/Aaralink/Aralink"
supabase functions deploy generate-lease-pdf
```

### Step 3: Test from App

Generate a new lease and verify:
- ✅ PDF generates without errors
- ✅ URL returned is a signed URL (contains `?token=...`)
- ✅ PDF can be opened from app
- ✅ PDF appears in bucket

---

## 🧪 How to Verify

### Check 1: Verify Signed URL Format

The returned URL should look like:
```
https://[project].supabase.co/storage/v1/object/sign/lease-documents/leases/[user-id]/lease-[id].pdf?token=eyJhbG...
```

**Key indicators:**
- ✅ Contains `/sign/` (not `/public/`)
- ✅ Has `?token=...` parameter
- ✅ Token is a long JWT string

### Check 2: Test Direct Access

Copy the signed URL from the API response and paste it in your browser.

**Expected:**
- ✅ PDF downloads/displays successfully

**If it fails:**
- ❌ Check that service_role policies are added
- ❌ Check that the token hasn't expired
- ❌ Check that the file path is correct

### Check 3: Verify in Storage Bucket

1. Go to **Supabase Dashboard** → **Storage** → **lease-documents**
2. Navigate to: `leases/[user-id]/`
3. You should see: `lease-[id]-[timestamp].pdf`
4. Click on file → Should show file details
5. Click **Get URL** → Should generate signed URL

---

## 📋 Comparison: Public vs Signed URLs

### Public URL (getPublicUrl)
```
https://project.supabase.co/storage/v1/object/public/lease-documents/...
```
- ✅ Simple, no expiration
- ❌ Only works if bucket is PUBLIC
- ❌ Anyone with URL can access
- ❌ Not secure for sensitive documents

### Signed URL (createSignedUrl)
```
https://project.supabase.co/storage/v1/object/sign/lease-documents/...?token=eyJhbGc...
```
- ✅ Works with PRIVATE buckets
- ✅ Includes authentication token
- ✅ Has expiration (we set 1 year)
- ✅ More secure for sensitive documents
- ✅ Recommended for lease PDFs

---

## 🎯 Why This Matters

**Lease documents contain sensitive information:**
- Tenant personal info
- Landlord contact details
- Financial information (rent amounts, deposits)
- Property addresses

**Security Best Practices:**
1. ✅ Keep bucket **private** (not public)
2. ✅ Use **signed URLs** (not public URLs)
3. ✅ Set **expiration** on signed URLs
4. ✅ Use **RLS policies** to control access
5. ✅ Only allow users to access their own files

---

## 🔍 Troubleshooting

### "Bucket not found" Error Persists

**Check these:**

1. **Service role policies exist?**
   ```sql
   SELECT * FROM pg_policies 
   WHERE schemaname = 'storage' 
   AND tablename = 'objects'
   AND policyname LIKE '%service%';
   ```

2. **Environment variables set?**
   ```bash
   supabase secrets list
   ```
   Should show: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PDF_CO_API_KEY`

3. **Function redeployed after code change?**
   ```bash
   supabase functions deploy generate-lease-pdf
   ```

4. **Check function logs:**
   ```bash
   supabase functions logs generate-lease-pdf --tail
   ```

### "Signed URL expired" Error

**If users report PDFs not opening after some time:**

1. **Increase expiration time** (currently 1 year):
   ```typescript
   createSignedUrl(storagePath, 63072000); // 2 years
   ```

2. **Or regenerate signed URL when needed:**
   ```typescript
   // In your app, when user clicks "View PDF":
   const { data } = await supabase.storage
     .from('lease-documents')
     .createSignedUrl(pdfPath, 3600); // 1 hour
   
   // Open the fresh signed URL
   window.open(data.signedUrl);
   ```

---

## 📱 App-Side Changes (If Needed)

If your app is also trying to access the bucket directly, update it to use signed URLs:

### Before (won't work with private bucket):
```typescript
// In your React Native app
const { data } = supabase.storage
  .from('lease-documents')
  .getPublicUrl(pdfPath);

openPDF(data.publicUrl); // ❌ Won't work!
```

### After (works with private bucket):
```typescript
// In your React Native app
const { data, error } = await supabase.storage
  .from('lease-documents')
  .createSignedUrl(pdfPath, 3600); // 1 hour

if (data?.signedUrl) {
  openPDF(data.signedUrl); // ✅ Works!
}
```

---

## ✅ Complete Checklist

- [x] ✅ Code updated to use `createSignedUrl()` instead of `getPublicUrl()`
- [ ] ⚠️ Add service_role policies to storage bucket (DO THIS NOW)
- [ ] ⚠️ Redeploy edge function after code change
- [ ] Test lease generation from app
- [ ] Verify signed URL format (should contain `?token=...`)
- [ ] Test PDF opens in app
- [ ] Document signed URL expiration policy

---

## 🚀 Deploy Now

```bash
# 1. Go to Supabase Dashboard → Storage → lease-documents → Policies
# 2. Add the 2 service_role policies (INSERT and SELECT)
# 3. Then redeploy:

cd "/Users/ankitac862/Documents/ANKITA /FProject/Aaralink/Aralink"
supabase functions deploy generate-lease-pdf

# 4. Test from your app
# 5. Check the logs:
supabase functions logs generate-lease-pdf --tail
```

---

## Summary

✅ **Root Cause:** Private bucket + public URL = doesn't work  
✅ **Fix Applied:** Changed to signed URLs in code  
⚠️ **Still Need:** Add service_role policies to storage bucket  
⚠️ **Then:** Redeploy function  
✅ **Result:** PDFs will be accessible from app with signed URLs  

**Status:** 50% Fixed (code done, policies needed)  
**Time to Complete:** 5 minutes (add policies + redeploy)  
**Date:** January 25, 2026
