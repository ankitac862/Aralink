# Quick Deployment Guide

Follow these steps to deploy the Ontario Lease PDF generation with PDF.co.

## Prerequisites

- [ ] Supabase project set up
- [ ] PDF.co account with API key
- [ ] Ontario Lease Form 2229E template PDF

## Step-by-Step Deployment

### 1. Get PDF.co API Key

1. Sign up at https://pdf.co
2. Go to Dashboard → API Keys
3. Copy your API key

### 2. Upload Template PDF

**Option A: Use Supabase Storage**
```bash
# Upload template to Supabase Storage
# Via Dashboard: Storage → Create bucket "templates" → Upload file

# Or via CLI:
supabase storage create templates
supabase storage upload templates ontario-lease-2229e.pdf ./path/to/template.pdf --public
```

**Option B: Use External URL**
- Upload to any publicly accessible location
- Get the direct URL to the PDF file

### 3. Configure Secrets

```bash
# Navigate to your project
cd /path/to/Aaralink

# Set secrets (replace with your actual values)
supabase secrets set PDFCO_API_KEY=sk_your_api_key_here
supabase secrets set LEASE_TEMPLATE_URL=https://your-url.com/template.pdf

# Verify secrets are set
supabase secrets list
```

### 4. Deploy Edge Function

```bash
# Make sure you're in the Aralink directory
cd Aralink

# Deploy the function
supabase functions deploy generate-lease-pdf

# Expected output:
# ✓ Deployed Function generate-lease-pdf
# Function URL: https://[project-ref].supabase.co/functions/v1/generate-lease-pdf
```

### 5. Set Up Storage Bucket

```bash
# Create storage bucket (if not exists)
supabase storage create lease-documents --public

# Or via Dashboard:
# Storage → New bucket → Name: "lease-documents" → Public: Yes
```

### 6. Configure Storage Policies

Run this SQL in Supabase SQL Editor:

```sql
-- Allow authenticated users to read their own leases
CREATE POLICY "Users can read own leases"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lease-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own leases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lease-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own leases
CREATE POLICY "Users can update own leases"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lease-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 7. Test the Function

**Method 1: Using curl**

```bash
# Get your Supabase anon key from Dashboard → Settings → API
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Test the function
curl -X POST \
  "$SUPABASE_URL/functions/v1/generate-lease-pdf" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leaseId": "test-123",
    "formData": {
      "landlords": [{"legalName": "Test Landlord"}],
      "tenants": [{"firstName": "John", "lastName": "Doe"}],
      "rentalUnit": {
        "streetNumber": "123",
        "streetName": "Main St",
        "city": "Toronto",
        "province": "ON",
        "postalCode": "M5V 2N2",
        "isCondo": false
      },
      "contact": {
        "noticeAddress": "123 Main St",
        "emailConsent": true,
        "emergencyContactConsent": false
      },
      "term": {
        "startDate": "2026-02-01",
        "type": "fixed",
        "endDate": "2027-02-01"
      },
      "rent": {
        "dueDay": 1,
        "frequency": "monthly",
        "base": 2000,
        "total": 2000,
        "payableTo": "Test Landlord",
        "paymentMethods": ["e-transfer"]
      }
    }
  }'
```

**Method 2: Using your React Native app**

The existing `lease-generation-service.ts` should work with minimal changes. Just ensure your form data matches the new structure.

### 8. Verify Output

Check the response:

```json
{
  "success": true,
  "documentUrl": "https://[project].supabase.co/storage/v1/object/public/lease-documents/...",
  "documentId": "leases/user-id/lease-123-1234567890.pdf",
  "version": 1,
  "engineUsed": "pdfco"
}
```

Open the `documentUrl` in a browser to view the generated PDF.

## Troubleshooting

### Error: "PDF.co API key not configured"
```bash
# Re-set the secret
supabase secrets set PDFCO_API_KEY=your_key_here
supabase functions deploy generate-lease-pdf
```

### Error: "Lease template URL not configured"
```bash
# Re-set the template URL
supabase secrets set LEASE_TEMPLATE_URL=https://your-url.com/template.pdf
supabase functions deploy generate-lease-pdf
```

### Error: "Failed to fetch template"
- Verify the template URL is publicly accessible
- Try accessing the URL in a browser
- Check CORS settings if using external hosting

### Error: "Storage upload failed"
- Verify the `lease-documents` bucket exists
- Check storage policies are set correctly
- Ensure user is authenticated

### PDF positions are wrong
- See `FIELD_POSITIONS.md` for guidance on adjusting coordinates
- Test with the coordinate finder at https://pdf.co/playground

## Monitoring

### View Function Logs

```bash
# Real-time logs
supabase functions logs generate-lease-pdf --follow

# Recent logs
supabase functions logs generate-lease-pdf
```

### Check PDF.co Usage

1. Go to https://pdf.co/dashboard
2. View API usage and remaining credits

## Cost Optimization

### PDF.co Free Tier
- 100 API calls/month free
- After that: $0.10 per call (or subscribe to a plan)

### Reduce Costs
1. **Cache generated PDFs** - Don't regenerate if data hasn't changed
2. **Delete old versions** - Keep only current lease versions
3. **Monitor usage** - Set up alerts for API usage

## Next Steps

1. **Customize field positions** - Adjust coordinates in `index.ts` to match your template
2. **Update client code** - Ensure your React Native app sends data in the new format
3. **Add validation** - Implement input validation before generating PDFs
4. **Test with real data** - Generate leases with actual tenant/landlord information
5. **Set up monitoring** - Track generation success/failure rates

## Getting Help

- PDF.co Support: support@pdf.co
- Supabase Discord: https://discord.supabase.com
- Documentation: See README.md and FIELD_POSITIONS.md

## Rollback

If you need to rollback:

```bash
# View function history
supabase functions list

# Deploy previous version (if you have it backed up)
supabase functions deploy generate-lease-pdf --restore [version-id]
```

---

**Deployment Complete!** 🎉

Your Ontario Lease PDF generation is now live and ready to use.
