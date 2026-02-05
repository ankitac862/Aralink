# Lease PDF Generation - Setup Guide

This guide walks you through setting up the lease PDF generation feature step by step.

## Quick Summary

| Component | Required? | How to Set Up |
|-----------|-----------|---------------|
| Storage Bucket | ✅ Yes | Supabase Dashboard |
| Edge Functions | ✅ Yes | Supabase CLI or Dashboard |
| XFA Engine | ❌ No | Optional (fallback works without it) |
| PDF Generator | ❌ No | Optional (basic PDF works without it) |
| Email Service | ❌ No | Optional (in-app notifications still work) |

---

## Step 1: Create Storage Bucket (Required)

This stores the generated/uploaded lease PDFs.

### Via Supabase Dashboard:

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Click on **Storage** in the left sidebar
3. Click **New bucket**
4. Enter these settings:
   - **Name:** `lease-documents`
   - **Public bucket:** ❌ OFF (keep it private)
   - **File size limit:** `10` MB
   - **Allowed MIME types:** `application/pdf`
5. Click **Create bucket**

### Set Storage Policies:

After creating the bucket, click on it and go to **Policies** tab:

**Policy 1: Upload Policy**
```sql
-- Allow authenticated users to upload to their folder
CREATE POLICY "Users can upload lease documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

**Policy 2: Read Policy**
```sql
-- Allow users to read their own documents
CREATE POLICY "Users can read their lease documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

**Policy 3: Delete Policy**
```sql
-- Allow users to delete their own documents
CREATE POLICY "Users can delete their lease documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lease-documents' AND
  (storage.foldername(name))[1] = 'leases' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

---

## Step 2: Deploy Edge Functions (Required)

You have two options:

### Option A: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link your project:**
   ```bash
   cd /Users/ankitac862/Documents/ANKITA\ /FProject/Aaralink/Aralink
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   
   Find your project ref in Supabase Dashboard → Settings → General → Reference ID

4. **Deploy the functions:**
   ```bash
   supabase functions deploy generate-lease-pdf
   supabase functions deploy send-lease
   ```

### Option B: Via Supabase Dashboard (Alternative)

1. Go to Supabase Dashboard → **Edge Functions**
2. Click **Create a new function**
3. Name it `generate-lease-pdf`
4. Copy the code from `supabase/functions/generate-lease-pdf/index.ts`
5. Click **Deploy**
6. Repeat for `send-lease`

---

## Step 3: Configure Secrets (What You Actually Need)

### Required Secrets: NONE!

The basic functionality works without any external secrets because:
- PDF generation falls back to a basic built-in generator
- Lease storage uses Supabase Storage (already configured)
- In-app notifications work without email

### Optional Secrets (For Enhanced Features):

Go to Supabase Dashboard → **Edge Functions** → **Secrets** (or Project Settings → Edge Functions)

#### For Better PDF Generation:

**Option 1: html2pdf.app (Free tier available)**
```
PDF_GENERATOR_URL = https://api.html2pdf.app/v1/generate
PDF_GENERATOR_API_KEY = your_api_key_here
```
Sign up at: https://html2pdf.app

**Option 2: DocRaptor (Free trial)**
```
PDF_GENERATOR_URL = https://docraptor.com/docs
PDF_GENERATOR_API_KEY = your_api_key_here
```
Sign up at: https://docraptor.com

#### For Email Notifications:

**Option 1: Resend (Free tier: 100 emails/day)**
```
EMAIL_SERVICE_URL = https://api.resend.com/emails
EMAIL_API_KEY = re_xxxxxxxxxxxxx
FROM_EMAIL = leases@yourdomain.com
```
Sign up at: https://resend.com

**Option 2: SendGrid (Free tier: 100 emails/day)**
```
EMAIL_SERVICE_URL = https://api.sendgrid.com/v3/mail/send
EMAIL_API_KEY = SG.xxxxxxxxxxxxx
FROM_EMAIL = leases@yourdomain.com
```
Sign up at: https://sendgrid.com

#### For Official XFA Template (Advanced):

Only needed if you want to fill the official Ontario lease PDF template directly.
Most users won't need this - the fallback PDF looks professional.

```
XFA_ENGINE_URL = your_xfa_service_url
XFA_ENGINE_API_KEY = your_xfa_api_key
```

---

## Step 3.5: Property & Address Setup (Important)

Before generating leases, make sure every property/unit stores a structured address so the wizard can auto-fill it:

1. Open the **Add Property** screen and let the Google Places autocomplete populate the separate fields (Unit, Street Number, Street Name, City, Province, Postal Code). The component pulls the data from the Google Places API and fills each piece automatically.
2. If the autocomplete call fails (permissions, offline, or no result), you can still type in each field manually. The structured address is the source of truth, so it's OK to edit any part of it afterward.
3. For rooms/sub-units you generate leases from, the property detail screen now shows “Generate Lease” buttons at the room level. Those buttons reuse the stored address + tenant name from that room.
4. When launching the lease wizard from a tenant or property, the form pre-fills the stored location. You can still edit the address before generating the PDF if anything changed.

Keeping the structured address accurate ensures the generated PDF always shows the correct leased location.

---

## Step 4: Test the Feature

### Test PDF Generation:

1. Open your app
2. Go to a property → **Lease Management**
3. Click **Generate New Lease**
4. Fill out the wizard (Steps 1-5)
5. On Step 6, click **Generate**
6. You should see a success message
7. Click **View** to see the generated PDF

### Test Without Any External Services:

Even without setting up external services, you can:
- ✅ Generate a basic lease PDF
- ✅ Store it in Supabase Storage
- ✅ View/Download the PDF
- ✅ Send to tenant (creates in-app notification)
- ❌ Email notifications won't be sent (but that's okay!)

---

## Troubleshooting

### "Edge function not found"
- Make sure the functions are deployed
- Check the function name matches exactly: `generate-lease-pdf` and `send-lease`

### "Storage upload failed"
- Verify the `lease-documents` bucket exists
- Check the storage policies are set correctly
- Ensure the bucket is NOT public

### "PDF generation failed"
- This is okay! The fallback PDF generator should work
- If it still fails, check the Edge Function logs in Supabase Dashboard

### "Failed to send lease"
- If email fails but you see "notificationSent: true", that's fine
- The in-app notification was created; email is optional

---

## Minimal Working Setup

**Absolute minimum to get it working:**

1. ✅ Run the database migration (already done)
2. ✅ Create `lease-documents` storage bucket
3. ✅ Deploy the two Edge Functions
4. ✅ Test the feature

**That's it!** No external API keys required for basic functionality.

---

## Architecture Without External Services

```
┌─────────────────────────────────────────────────┐
│                    Your App                     │
│  ├── Generate Lease (Step 6)                    │
│  ├── View/Download PDF                          │
│  └── Send to Tenant                             │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│         Supabase Edge Functions                 │
│  ├── generate-lease-pdf                         │
│  │   └── Uses built-in HTML template            │
│  │       (No external service needed)           │
│  └── send-lease                                 │
│      └── Creates in-app notification            │
│          (Email skipped if not configured)      │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           Supabase (Your Project)                
│  ├── Database: leases, lease_documents tables   │
│  ├── Storage: lease-documents bucket            │
│  └── Auth: User authentication                  │
└─────────────────────────────────────────────────┘
```

---

## Next Steps After Setup

1. **Test locally** - Generate a test lease
2. **Add email later** - Sign up for Resend/SendGrid when ready
3. **Add better PDF** - Sign up for html2pdf.app when ready
4. **Production** - Same setup, just different Supabase project
