# PDF Template Filling Setup

Your Edge Function is generating a basic text PDF instead of filling the actual template form fields. Here's how to fix it:

## Problem

- ✅ Template is fetched successfully
- ❌ No PDF form filling service configured
- ⚠️ Falls back to simple text PDF

## Solution: Use PDF.co (Recommended)

### Why PDF.co?
- ✅ Free tier: 100 PDFs/month
- ✅ Easy to use API
- ✅ Works with fillable PDF forms
- ✅ Low cost after free tier (~$0.01/PDF)

### Step 1: Sign Up

1. Go to https://pdf.co
2. Sign up for free account
3. Go to Dashboard → API → Keys
4. Copy your API key

### Step 2: Add API Key to Supabase

1. **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**
2. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `PDF_FILLER_URL` | `https://api.pdf.co/v1/pdf/edit/add` |
| `PDF_FILLER_API_KEY` | Your PDF.co API key (from Dashboard → API) |

**Important:** 
- Use `/edit/add` endpoint (this is the correct endpoint for filling PDF forms)!
- After changing secrets, you MUST redeploy the function!
- **Reference:** [PDF.co Fill PDF Form Docs](https://docs.pdf.co/integrations/n8n/fill-a-pdf-form#fill-a-pdf-form)

### Step 3: Update Edge Function

The Edge Function is already configured to use an external PDF filler! Once you add the secrets above, it will automatically:

1. Fetch your template
2. Send it to PDF.co to fill the form fields
3. Return the filled PDF
4. Fall back to text PDF if anything fails

### Step 4: Test

Generate a lease again - it should now fill the actual template form fields!

---

## Alternative: Adobe PDF Services (Enterprise)

If you need the most reliable solution:

### Step 1: Sign Up

1. Go to https://developer.adobe.com/document-services/
2. Get credentials (Client ID + Client Secret)

### Step 2: Add to Supabase Secrets

| Secret Name | Value |
|-------------|-------|
| `ADOBE_CLIENT_ID` | Your Adobe Client ID |
| `ADOBE_CLIENT_SECRET` | Your Adobe Client Secret |
| `ADOBE_PDF_SERVICES_URL` | `https://pdf-services.adobe.io/operation/pdffill` |

### Step 3: Update Edge Function Code

I can provide Adobe-specific code if you choose this option.

---

## How It Works

### Current Flow (No Service Configured):
```
Template → ❌ No Filler → Text PDF (fallback)
```

### With PDF.co:
```
Template → PDF.co API → ✅ Filled Template PDF
```

### Form Field Mapping

Your template form fields will be automatically filled:

| Form Data | PDF Field |
|-----------|-----------|
| Landlord Name | `Landlords Legal Name` |
| Tenant Name | `Last Name`, `First Name` |
| Unit | `Unit` |
| Street Number | `Street Number` |
| Street Name | `Street Name` |
| City | `CityTown` |
| Province | `Province` |
| Postal Code | `Postal Code` |
| Start Date | `Date yyyymmdd` |
| Base Rent | `Base rent for the rental unit` |
| ... | ... |

---

## Cost Comparison

| Service | Free Tier | Paid |
|---------|-----------|------|
| **PDF.co** | 100/month | $0.01/PDF |
| **Adobe PDF Services** | 1000/month trial | $0.05/PDF |
| **PDFMonkey** | 300/month | $29/month |
| **Current (Text PDF)** | ∞ Free | Free |

---

## Recommended: Start with PDF.co

1. Sign up (5 min)
2. Add API key to Supabase secrets (2 min)
3. Test (1 min)

Total: ~10 minutes to get form filling working!

---

## Testing PDF.co

After adding the secrets, check the Edge Function logs:

```
✅ Template fetched, size: 779551 bytes
✅ External PDF filler configured
✅ Filling PDF via PDF.co...
✅ PDF filled successfully
✅ PDF uploaded
```

Instead of:
```
⚠️ No PDF filler service configured, falling back to standard generation
```

---

## Need Help?

If you want to use Adobe PDF Services or need help with PDF.co integration, let me know and I can:
1. Update the Edge Function with the specific API integration
2. Create the exact field mapping for your template
3. Help debug any API issues
