# Ontario Lease PDF Generation with PDF.co

This Supabase Edge Function generates Ontario Standard Lease Form 2229E PDFs using PDF.co's API.

## Features

- **Supports up to 4 landlords** and **12 tenants**
- **7-page legally compliant** Ontario Standard Lease document
- **Text overlays** for all form data (Sections 1-15)
- **Editable signature fields** (Section 17) using AcroForm
- **Checkbox rendering** (☑ for checked, ☐ for unchecked)
- **Professional formatting** with proper fonts, sizes, and positioning

## Prerequisites

1. **PDF.co Account**
   - Sign up at https://pdf.co
   - Get your API key from the dashboard

2. **Ontario Lease Template PDF**
   - Upload the base Form 2229E PDF template (blank or partially filled)
   - Get a publicly accessible URL (can use Supabase Storage)

3. **Supabase Project**
   - Edge Functions enabled
   - Storage bucket `lease-documents` created

## Setup Instructions

### 1. Configure Environment Variables

In your Supabase Dashboard → Edge Functions → Secrets, add:

```bash
PDFCO_API_KEY=your_pdfco_api_key_here
LEASE_TEMPLATE_URL=https://your-domain.com/path/to/ontario-lease-template.pdf
```

### 2. Deploy the Edge Function

```bash
cd Aralink/supabase/functions
supabase functions deploy generate-lease-pdf
```

### 3. Set up Storage Bucket

In Supabase Dashboard → Storage:

1. Create bucket: `lease-documents`
2. Set policies:
   - **SELECT**: Authenticated users can read their own leases
   - **INSERT**: Authenticated users can upload to their folder
   - **UPDATE**: Authenticated users can update their files

Example RLS policy:

```sql
-- Allow users to read their own lease documents
CREATE POLICY "Users can read own leases"
ON storage.objects FOR SELECT
USING (bucket_id = 'lease-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to insert into their own folder
CREATE POLICY "Users can upload own leases"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lease-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 4. Update Database Schema (Optional)

If you want version tracking, create the `lease_documents` table:

```sql
CREATE TABLE lease_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  file_size INTEGER,
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT true,
  engine_used TEXT CHECK (engine_used IN ('pdfco', 'standard', 'uploaded')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lease_documents_lease_id ON lease_documents(lease_id);
CREATE INDEX idx_lease_documents_current ON lease_documents(lease_id, is_current) WHERE is_current = true;
```

## Usage

### Client-Side Call

```typescript
import { generateLeasePdf } from '@/services/lease-generation-service';

const formData: OntarioLeaseFormData = {
  landlords: [
    { legalName: "John Smith" },
    { legalName: "Jane Doe Corporation" }
  ],
  tenants: [
    { firstName: "Alice", lastName: "Johnson" },
    { firstName: "Bob", lastName: "Williams" }
  ],
  rentalUnit: {
    unit: "4B",
    streetNumber: "123",
    streetName: "Main Street",
    city: "Toronto",
    province: "ON",
    postalCode: "M5V 2N2",
    parkingSpaces: 1,
    isCondo: true
  },
  contact: {
    noticeAddress: "123 Main St, Toronto ON M5V 2N2",
    emailConsent: true,
    emails: ["landlord@example.com"],
    emergencyContactConsent: true,
    emergencyContact: "416-555-1234"
  },
  term: {
    startDate: "2026-02-01",
    type: "fixed",
    endDate: "2027-02-01"
  },
  rent: {
    dueDay: 1,
    frequency: "monthly",
    base: 2000,
    parking: 100,
    total: 2100,
    payableTo: "John Smith",
    paymentMethods: ["e-transfer", "cheque"],
    nsfFee: 25
  },
  utilities: {
    electricity: "tenant",
    heat: "landlord",
    water: "landlord"
  },
  services: {
    gas: true,
    airConditioning: true,
    storage: true,
    laundry: "included",
    guestParking: "free"
  },
  deposits: {
    rentDepositRequired: true,
    rentDepositAmount: 2000,
    keyDepositRequired: true,
    keyDepositAmount: 50,
    keyDepositDescription: "For 2 keys and 1 fob"
  },
  smoking: {
    hasRules: true,
    rulesDescription: "No smoking anywhere in the building or on balconies"
  },
  insurance: {
    required: true
  },
  additionalTerms: {
    hasAdditionalTerms: true,
    description: "Tenant responsible for changing HVAC filters quarterly."
  }
};

const result = await generateLeasePdf(leaseId, formData);

if (result.success) {
  console.log('PDF generated:', result.documentUrl);
} else {
  console.error('Error:', result.error);
}
```

### Response Format

Success:
```json
{
  "success": true,
  "documentUrl": "https://your-supabase.supabase.co/storage/v1/object/public/lease-documents/...",
  "documentId": "leases/user-id/lease-123-1234567890.pdf",
  "version": 1,
  "engineUsed": "pdfco"
}
```

Error:
```json
{
  "success": false,
  "code": "PDFCO_API_ERROR",
  "error": "PDF.co API error: 401 - Invalid API key"
}
```

## PDF.co API Details

### Text Annotations

The function uses PDF.co's text annotation feature to overlay data onto the template:

```typescript
{
  "x": 100,              // X position in points (72 points = 1 inch)
  "y": 200,              // Y position in points
  "text": "Sample text",  // Text content
  "fontName": "Helvetica", // Font family
  "fontSize": 10,         // Font size in points
  "color": "000000",      // Hex color (black)
  "pages": "0"            // Page number (0-indexed, or "0,1,2" for multiple)
}
```

### Signature Fields

Editable AcroForm signature fields for Section 17:

```typescript
{
  "fieldType": "signature",
  "fieldName": "landlord_sig_1",
  "x": 50,
  "y": 150,
  "width": 200,
  "height": 40,
  "pages": "6"  // Page 7 (0-indexed)
}
```

### API Call

```typescript
POST https://api.pdf.co/v1/pdf/edit/add
Headers:
  x-api-key: your_api_key
  Content-Type: application/json

Body:
{
  "url": "https://your-template-url.pdf",
  "name": "ontario-lease-123.pdf",
  "annotations": [...],  // Text overlays
  "fields": [...],       // Signature fields
  "async": false
}
```

## Customization

### Adjusting Positions

If text doesn't align perfectly with your template, adjust the X and Y coordinates in `buildPdfCoAnnotations()`:

```typescript
// Example: Move landlord names down by 10 points
annotations.push({
  x: 100,
  y: 110,  // Changed from 100
  text: landlord.legalName,
  // ...
});
```

### Adding More Fields

To add new fields to the PDF:

1. Add the field to the `buildPdfCoAnnotations()` function
2. Determine the correct page, position, and styling
3. Test with sample data

### Changing Fonts

Available fonts in PDF.co:
- `Helvetica` (default)
- `Helvetica-Bold`
- `Times-Roman`
- `Courier`

## Troubleshooting

### PDF.co Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| 401 | Invalid API key | Check `PDFCO_API_KEY` in Supabase secrets |
| 402 | Insufficient credits | Add credits to your PDF.co account |
| 404 | Template not found | Verify `LEASE_TEMPLATE_URL` is accessible |
| 400 | Invalid request | Check annotation/field format |

### Storage Errors

- **Upload failed**: Check storage bucket exists and has correct permissions
- **No public URL**: Verify bucket is public or use signed URLs

### Positioning Issues

1. **Text not visible**: Check if Y coordinates are within page bounds (0-792 for Letter size)
2. **Text cut off**: Adjust font size or line breaks
3. **Wrong page**: Verify `pages` parameter (0-indexed)

## Testing

Test with sample data:

```bash
# Using curl
curl -X POST \
  https://your-project.supabase.co/functions/v1/generate-lease-pdf \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leaseId": "test-123",
    "formData": {
      "landlords": [{"legalName": "Test Landlord"}],
      "tenants": [{"firstName": "Test", "lastName": "Tenant"}],
      ...
    }
  }'
```

## Cost Estimation

PDF.co pricing (as of 2026):
- **Free tier**: 100 API calls/month
- **Starter**: $9.99/month (1,000 calls)
- **Professional**: $39.99/month (5,000 calls)
- **Enterprise**: Custom pricing

Each PDF generation = 1 API call

## Support

- PDF.co Documentation: https://docs.pdf.co/
- PDF.co Support: https://pdf.co/support
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

## License

This code is part of the Aralink application. Refer to the main project license.
