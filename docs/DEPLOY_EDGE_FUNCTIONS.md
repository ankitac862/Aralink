# Deploy Edge Functions to Supabase

## Prerequisites

✅ You've already done:
- Created `lease-documents` bucket
- Created `templates` bucket  
- Uploaded `2229e_standard-lease_static.pdf` to templates bucket
- Added `LEASE_TEMPLATE_URL` secret to Edge Functions

## Step 1: Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window. Log in with your Supabase account.

## Step 3: Link Your Project

```bash
cd "/Users/ankitac862/Documents/ANKITA /FProject/Aaralink/Aralink"
supabase link --project-ref YOUR_PROJECT_REF
```

**To find your project ref:**
1. Go to Supabase Dashboard
2. Settings → General → Reference ID
3. Copy the project reference ID (e.g., `ykfecigqskkddpphbdop`)

## Step 4: Deploy the Edge Function

```bash
supabase functions deploy generate-lease-pdf
```

This will:
- Bundle your function code
- Deploy it to Supabase Edge Functions
- Make it available at: `https://YOUR_PROJECT.supabase.co/functions/v1/generate-lease-pdf`

## Step 5: Verify Deployment

```bash
supabase functions list
```

You should see `generate-lease-pdf` in the list with status "deployed".

## Step 6: Test the Function

Try generating a lease from your app:

1. Open the app
2. Go to a property
3. Click "Generate Lease"
4. Fill in all the wizard steps
5. Click "Generate"
6. ✅ Should generate successfully
7. ✅ Click "View" to see the PDF
8. ✅ Check that all sections 1-17 are included

## Troubleshooting

### Error: "Command not found: supabase"

Install the CLI:
```bash
npm install -g supabase
```

### Error: "Project not linked"

Make sure you ran `supabase link`:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Error: "Function deploy failed"

Check your function code for syntax errors:
```bash
cd supabase/functions/generate-lease-pdf
deno check index.ts
```

### Error: "Bucket not found"

Make sure you created the `lease-documents` bucket in Supabase Dashboard → Storage.

### Function deploys but PDF generation fails

Check the Edge Function logs:
```bash
supabase functions logs generate-lease-pdf
```

Or in Dashboard → Edge Functions → generate-lease-pdf → Logs

## Environment Variables / Secrets

Make sure these are set in Supabase Dashboard → Edge Functions → Settings → Secrets:

| Secret Name | Value | Required? |
|-------------|-------|-----------|
| `LEASE_TEMPLATE_URL` | URL to your PDF template | Optional (fallback works without it) |
| `SUPABASE_URL` | Auto-set by Supabase | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase | ✅ Yes |

## What the Function Does

1. **Receives request** from your app with lease form data
2. **Checks for template URL** - if set, tries to fetch it
3. **Falls back to HTML-to-PDF** generation (always works)
4. **Stores PDF** in `lease-documents` bucket
5. **Creates database record** in `lease_documents` table
6. **Returns URL** to the stored PDF

## Next Steps

After deployment:
1. Generate a test lease
2. Verify all 17 sections appear correctly
3. Test View/Download functionality
4. Test the "Send Lease" feature (sends email + in-app notification)

## Quick Deploy Command

For future updates, just run:

```bash
cd "/Users/ankitac862/Documents/ANKITA /FProject/Aaralink/Aralink"
supabase functions deploy generate-lease-pdf
```

That's it! Your Edge Function is now live and ready to generate lease PDFs! 🎉
