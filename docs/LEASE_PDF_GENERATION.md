# Lease PDF Generation System

This document describes the implementation of the Ontario Standard Lease PDF generation system.

## Overview

The lease PDF generation system supports two approaches:

1. **XFA Template Filling** (Primary) - Uses the official Ontario Standard Lease XFA template (2229e.pdf)
2. **HTML-to-PDF Generation** (Fallback) - Generates a compliant PDF from scratch when XFA fails

### Why Two Approaches?

The official Ontario Standard Lease PDF (2229e.pdf) is an XFA-based form, which cannot be reliably filled using common client-side PDF libraries like `pdf-lib`. XFA forms require specialized server-side engines to properly fill and flatten.

If XFA generation fails (engine not configured, merge fails, or template unsupported), the system automatically falls back to generating a standard PDF from HTML, which matches the Ontario lease sections 1-17 content.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React Native)                   │
├─────────────────────────────────────────────────────────────────┤
│  useOntarioLeaseStore      │   LeaseWizard Step 6               │
│  ├── generateOfficialPdf() │   ├── Generate Button              │
│  ├── sendLease()           │   ├── View/Download                │
│  └── uploadLease()         │   └── Send to Tenant               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               lease-generation-service.ts                        │
│  ├── generateLeasePdf() - Calls edge function                   │
│  ├── sendLeaseToTenant() - Calls edge function                  │
│  └── getLeaseDocumentVersions()                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               Supabase Edge Functions                            │
├─────────────────────────────────────────────────────────────────┤
│  generate-lease-pdf/                                             │
│  ├── tryXfaGeneration() - XFA with external engine              │
│  ├── generateStandardPdf() - HTML-to-PDF fallback               │
│  └── storePdf() - Storage + versioning                          │
├─────────────────────────────────────────────────────────────────┤
│  send-lease/                                                     │
│  ├── sendEmailNotification() - Email with PDF link              │
│  └── createInAppNotification() - In-app notification            │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /functions/v1/generate-lease-pdf

Generates a lease PDF with automatic XFA-to-fallback behavior.

**Request:**
```json
{
  "leaseId": "uuid",
  "formData": { /* OntarioLeaseFormData */ },
  "useXfa": true  // optional, default true
}
```

**Response:**
```json
{
  "success": true,
  "documentUrl": "https://...",
  "documentId": "uuid",
  "version": 1,
  "engineUsed": "xfa" | "standard",
  "code": "FALLBACK_USED",  // if fallback was triggered
  "warning": "..."  // user-facing warning message
}
```

**Error Codes:**
- `XFA_ENGINE_NOT_CONFIGURED` - XFA engine credentials not set
- `XFA_GENERATION_FAILED` - XFA merge failed
- `STANDARD_GENERATION_FAILED` - Fallback also failed
- `FALLBACK_USED` - XFA failed, fallback succeeded (not an error)

### POST /functions/v1/send-lease

Sends the lease to the tenant via email and in-app notification.

**Request:**
```json
{
  "leaseId": "uuid",
  "tenantEmail": "override@email.com",  // optional
  "sendEmail": true,
  "sendNotification": true,
  "message": "Please review..."  // optional custom message
}
```

**Response:**
```json
{
  "success": true,
  "status": "sent",
  "emailSent": true,
  "notificationSent": true
}
```

## Environment Variables

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

### Required (Auto-injected)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### XFA Generation (Optional)
- `XFA_ENGINE_URL` - URL of XFA-capable PDF service
- `XFA_ENGINE_API_KEY` - API key for XFA engine

Supported XFA engines:
- Adobe PDF Services API
- Apryse/PDFTron (if XFA module licensed)
- Datalogics/Adobe PDF Library

### Standard PDF Generation (Optional)
- `PDF_GENERATOR_URL` - URL of HTML-to-PDF service
- `PDF_GENERATOR_API_KEY` - API key

Recommended services:
- html2pdf.app
- DocRaptor
- Self-hosted Puppeteer/Playwright

### Email Notifications (Optional)
- `EMAIL_SERVICE_URL` - Email API endpoint
- `EMAIL_API_KEY` - API key
- `FROM_EMAIL` - Sender address (default: noreply@aaralink.com)

Recommended services:
- Resend
- SendGrid
- AWS SES

## Form Data Limits

Per Ontario Standard Lease requirements:

| Field | Limit |
|-------|-------|
| Tenants | Max 14 |
| Landlords | Max 11 |
| Other Services | Unlimited (continuation pages generated) |

## Conditional Sections

The following sections are only rendered when applicable:

- **Rent Discount** - Only if `rentDiscountEnabled: true`
- **Smoking Rules** - Only if `smokingRulesEnabled: true`
- **Additional Terms** - Only if `additionalTerms` is not empty
- **Rent Deposit** - Only if `rentDepositRequired: true`
- **Key Deposit** - Only if `keyDepositRequired: true`

## Storage & Versioning

- PDFs are stored in the `lease-documents` Supabase Storage bucket
- Each regeneration creates a new version
- Path format: `leases/{userId}/{leaseId}/v{version}-{timestamp}.pdf`
- Previous versions are retained
- `is_current` flag marks the active version

## Status Flow

```
Draft → Generated → Sent → Signed
         ↓
      Uploaded → Sent → Signed
```

## Frontend Integration

### Generate Button (Step 6)
```typescript
const handleGenerate = async () => {
  const result = await generateOfficialPdf(userId);
  
  if (result.success) {
    if (result.warning) {
      // Show warning about fallback
      Alert.alert('Generated', result.warning);
    }
    // Document is now available at result.documentUrl
  }
};
```

### Send Button
```typescript
const handleSend = async () => {
  const result = await sendLease(tenantEmail, message);
  
  if (result.success) {
    // Lease status updated to 'sent'
    // Email and/or notification sent
  }
};
```

### Tenant View
```typescript
// Tenants access their leases via:
router.push('/tenant-view-lease');

// Or for a specific lease:
router.push(`/tenant-view-lease?id=${leaseId}`);
```

## Testing

### Basic Tests

1. **Mapping Validation**
   - Test tenant name limit (>14 should truncate or error)
   - Test landlord limit (>11)
   - Test conditional field rendering

2. **API Contract Tests**
   - Generate with valid data → success
   - Generate without leaseId → 400 error
   - Generate without auth → 401 error
   - Send without document → 400 error

3. **Fallback Behavior**
   - When XFA_ENGINE_URL not set → fallback triggered
   - When XFA engine returns error → fallback triggered
   - When both fail → appropriate error returned

### Smoke Test Plan

1. Create a new lease in the wizard
2. Fill in all required fields
3. Click "Generate" button
4. Verify PDF is created and viewable
5. Click "Send to Tenant"
6. Verify tenant receives notification
7. As tenant, verify lease is viewable in "My Leases"

## Troubleshooting

### "XFA engine not configured"
Set `XFA_ENGINE_URL` and `XFA_ENGINE_API_KEY` in Edge Function secrets.

### "PDF generation failed"
Check if `PDF_GENERATOR_URL` is set, or if there's an error in the HTML template.

### "Failed to send email"
Verify `EMAIL_SERVICE_URL`, `EMAIL_API_KEY`, and `FROM_EMAIL` are set correctly.

### Document not appearing for tenant
Ensure:
- Lease status is 'sent' or 'signed'
- `tenant_id` on lease matches tenant's user ID
- RLS policies are properly configured
