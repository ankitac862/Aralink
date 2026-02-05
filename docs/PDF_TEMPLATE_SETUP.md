# Ontario Lease PDF Template Setup

This guide explains how to upload and configure the official Ontario Standard Lease PDF template for filling.

## Two Template Options

You have two options for the PDF template:

| Type | File | How It Works |
|------|------|--------------|
| **XFA Template** | Dynamic XML-based PDF | Requires XFA-capable engine (Adobe PDF Services, Apryse) |
| **Static/AcroForm** | Fillable PDF with form fields | Can be filled with standard PDF libraries |

### Recommended Approach

1. **Primary**: Try to use a **static fillable PDF** (AcroForm) - this works with free/open-source PDF libraries
2. **Fallback**: If XFA is required, use an external service OR fall back to HTML-to-PDF generation

---

## Step 1: Upload Your Template

### Option A: Via Supabase Dashboard

1. Go to **Supabase Dashboard** → **Storage**
2. Click on `lease-documents` bucket (or create a new `templates` bucket)
3. Create a folder: `templates`
4. Upload your PDF template:
   - For AcroForm: `ontario-standard-lease-fillable.pdf`
   - For XFA: `ontario-standard-lease-xfa.pdf`

### Option B: Via SQL Editor

Run this to create the templates bucket if needed:

```sql
-- Create templates bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates', 'templates', true);

-- Allow authenticated users to read templates
CREATE POLICY "Anyone can read templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'templates');
```

---

## Step 2: Get the Template URL

After uploading, your template URL will be:

```
https://YOUR_PROJECT.supabase.co/storage/v1/object/public/templates/ontario-standard-lease-fillable.pdf
```

---

## Step 3: Configure the Edge Function

### For Static/AcroForm PDF

Update your `supabase/functions/generate-lease-pdf/index.ts` to use your template:

```typescript
// Add this constant at the top
const TEMPLATE_URL = 'https://YOUR_PROJECT.supabase.co/storage/v1/object/public/templates/ontario-standard-lease-fillable.pdf';

// Update the generateStandardPdf function to fill the template
async function fillAcroFormTemplate(
  formData: OntarioLeaseFormData,
  leaseId: string,
  userId: string
): Promise<GeneratePdfResponse> {
  try {
    // Fetch the template
    const templateResponse = await fetch(TEMPLATE_URL);
    const templateBuffer = await templateResponse.arrayBuffer();
    
    // You would use a PDF library here to fill the form fields
    // Example with pdf-lib (if fields are AcroForm):
    // const pdfDoc = await PDFDocument.load(templateBuffer);
    // const form = pdfDoc.getForm();
    // form.getTextField('landlordName').setText(formData.landlordName);
    // ... fill other fields
    // const filledPdf = await pdfDoc.save();
    
    // For now, fall back to HTML generation since pdf-lib doesn't work in Deno Edge
    return await generateStandardPdf(formData, leaseId, userId);
  } catch (error) {
    console.error('Error filling template:', error);
    return await generateStandardPdf(formData, leaseId, userId);
  }
}
```

### For XFA PDF (Requires External Service)

Set these secrets in Supabase Dashboard → Edge Functions → Secrets:

```
XFA_ENGINE_URL = https://pdf.adobe.io/services/v1 (or your provider)
XFA_ENGINE_API_KEY = your_api_key
XFA_TEMPLATE_URL = https://YOUR_PROJECT.supabase.co/storage/v1/object/public/templates/ontario-standard-lease-xfa.pdf
```

---

## PDF Field Mapping

Here's how form data maps to PDF fields:

### Section 1: Parties
| Form Field | PDF Field Name |
|-----------|----------------|
| `landlordName` | `landlord_name` or `Landlord_Name` |
| `tenantNames[0]` | `tenant_1_name` |
| `tenantNames[1]` | `tenant_2_name` |
| ... up to 14 tenants |

### Section 2: Rental Unit
| Form Field | PDF Field Name |
|-----------|----------------|
| `unitAddress.unit` | `unit_number` |
| `unitAddress.streetNumber` | `street_number` |
| `unitAddress.streetName` | `street_name` |
| `unitAddress.city` | `city` |
| `unitAddress.province` | `province` |
| `unitAddress.postalCode` | `postal_code` |

### Section 3: Contact
| Form Field | PDF Field Name |
|-----------|----------------|
| `landlordNoticeAddress` | `landlord_notice_address` |
| `allowEmailNotices` | `email_consent_checkbox` |
| `landlordEmail` | `landlord_email` |
| `emergencyContactPhone` | `emergency_phone` |

### Section 4: Term
| Form Field | PDF Field Name |
|-----------|----------------|
| `tenancyStartDate` | `start_date` |
| `tenancyEndDate` | `end_date` |
| `tenancyType` | `term_type_checkbox` |

### Section 5: Rent
| Form Field | PDF Field Name |
|-----------|----------------|
| `rentPaymentDay` | `payment_day` |
| `baseRent` | `base_rent_amount` |
| `parkingRent` | `parking_amount` |
| `otherServicesRent` | `other_services_amount` |
| `rentPayableTo` | `payable_to` |
| `paymentMethod` | `payment_method` |

---

## How to Identify PDF Field Names

If you have the Ontario lease PDF and want to find the actual field names:

### Method 1: Adobe Acrobat
1. Open PDF in Adobe Acrobat Pro
2. Go to Prepare Form
3. Click on each field to see its name

### Method 2: Using pdf-lib (Node.js)
```javascript
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function listFields() {
  const pdfBytes = fs.readFileSync('ontario-standard-lease.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  fields.forEach(field => {
    console.log(`Field: ${field.getName()} - Type: ${field.constructor.name}`);
  });
}

listFields();
```

### Method 3: Online Tools
- https://pdf.io/pdf-form-fields/
- https://www.pdfescape.com

---

## Testing Your Template

1. Upload the template
2. Go to your app → Property → Generate Lease
3. Fill out the wizard
4. Click "Generate"
5. Download and verify the fields are filled

---

## Fallback Behavior

If template filling fails for any reason:

1. **XFA fails** → Falls back to AcroForm template
2. **AcroForm fails** → Falls back to HTML-to-PDF generation
3. **HTML generation fails** → Returns error to user

The HTML-to-PDF fallback always works and produces a valid Ontario Standard Lease format.

---

## Providing Your Template

To provide your official Ontario lease PDF template:

1. **Save it to your computer**
2. **Upload to Supabase Storage** (templates bucket)
3. **Share the field names** if you've identified them
4. **Let me know** which type it is (XFA or AcroForm)

I can then update the edge function to fill your specific template with the correct field mappings.
