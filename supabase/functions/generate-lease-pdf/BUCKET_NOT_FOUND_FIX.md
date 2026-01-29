# Fix: "Bucket not found" Error (404)

## Problem
The bucket `lease-documents` exists in your Supabase dashboard, but the Edge Function returns:
```json
{"statusCode": "404", "error": "Bucket not found", "message": "Bucket not found"}
```

## Root Causes

### 1. Environment Variables Not Set ⚠️
The Edge Function needs these secrets to access your Supabase project:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PDF_CO_API_KEY=your-pdfco-key
LEASE_TEMPLATE_URL=https://your-bucket.supabase.co/storage/v1/object/public/templates/2229e_standard-lease_static.pdf
```

### 2. Wrong Supabase Project
The function might be connecting to a different project than where your bucket exists.

---

## ✅ Solution: Set Environment Variables

### Step 1: Get Your Credentials

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: Make sure it's the one with the `lease-documents` bucket
3. **Go to Settings > API**
4. Copy these values:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **Service Role Key** (secret key - starts with `eyJ...`)

### Step 2: Set Secrets in Edge Function

```bash
# Navigate to your project
cd /Users/ankitac862/Documents/ANKITA\ /FProject/Aaralink/Aralink

# Set Supabase URL
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co

# Set Service Role Key (replace with your actual key)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Set PDF.co API Key
supabase secrets set PDF_CO_API_KEY=your-pdfco-api-key

# Set template URL (adjust bucket name if needed)
supabase secrets set LEASE_TEMPLATE_URL=https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/templates/2229e_standard-lease_static.pdf
```

### Step 3: Redeploy the Function

```bash
supabase functions deploy generate-lease-pdf
```

### Step 4: Verify Secrets Are Set

```bash
supabase secrets list
```

You should see all 4 secrets listed.

---

## Alternative: Check If You're Using Supabase Local vs Cloud

### If using Supabase Local (supabase start):
```bash
# The function automatically uses local Supabase
# Check that the bucket exists locally:
supabase storage ls lease-documents
```

### If bucket doesn't exist locally:
```bash
# Create it:
supabase storage create lease-documents

# Or sync from cloud:
supabase db pull
```

---

## Verify Bucket Exists and Has Correct Permissions

### 1. Check Bucket Name
In your dashboard, verify the bucket is named **exactly** `lease-documents` (case-sensitive).

### 2. Create RLS Policy for Edge Function

Go to **Storage > Policies** and create this policy:

**Policy Name:** Allow Edge Function to Upload  
**Target Roles:** `service_role`  
**Operation:** INSERT, SELECT  
**Policy Definition:**

```sql
-- Allow service role (Edge Functions) to upload
CREATE POLICY "Allow service role to upload"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'lease-documents');

-- Allow service role to read
CREATE POLICY "Allow service role to read"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'lease-documents');
```

Or use the UI to create a policy:
- **Policy for:** `storage.objects`
- **Policy name:** `Allow Edge Function Access`
- **Allowed operation:** `INSERT` and `SELECT`
- **Target roles:** `service_role`
- **USING expression:** `bucket_id = 'lease-documents'`
- **WITH CHECK expression:** `bucket_id = 'lease-documents'`

---

## Quick Diagnostic

Run this test to check your setup:

```bash
# Test 1: Check secrets
supabase secrets list

# Test 2: Try to upload a test file manually
curl -X POST "https://YOUR_PROJECT.supabase.co/storage/v1/object/lease-documents/test.txt" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: text/plain" \
  --data "test"

# Test 3: Check if bucket exists via API
curl "https://YOUR_PROJECT.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## Most Likely Fix (Do This First!)

```bash
# 1. Get your project URL and service key from dashboard
# 2. Set them as secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set PDF_CO_API_KEY=your-pdfco-key

# 3. Redeploy
supabase functions deploy generate-lease-pdf

# 4. Test again from your app
```

---

## Still Not Working?

### Check Function Logs

```bash
# Watch logs in real-time
supabase functions logs generate-lease-pdf --tail

# Then trigger the function from your app and watch for errors
```

### Enable Debug Logging

Add this to your function call to see what's happening:

```typescript
// In index.ts, temporarily add console logs
console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseServiceKey);
console.log('Attempting to upload to bucket: lease-documents');
```

Then check logs with `supabase functions logs`.

---

## Summary Checklist

- [ ] Set `SUPABASE_URL` secret
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` secret  
- [ ] Set `PDF_CO_API_KEY` secret
- [ ] Bucket `lease-documents` exists (verify exact name)
- [ ] RLS policy allows `service_role` to upload
- [ ] Redeployed function after setting secrets
- [ ] Tested with `curl` or app

**Most common issue:** Forgot to set the secrets! Do Step 2 above first.
