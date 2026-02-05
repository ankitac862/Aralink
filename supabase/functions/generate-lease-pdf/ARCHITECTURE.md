# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          React Native App                                │
│                         (Aralink Mobile)                                 │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ 1. generateLeasePdf(leaseId, formData)
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Client Service (lease-generation-service.ts)                │
│  - Validates form data                                                   │
│  - Gets auth session                                                     │
│  - Calls edge function via HTTPS                                         │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ 2. POST /functions/v1/generate-lease-pdf
                 │    Authorization: Bearer <token>
                 │    Body: { leaseId, formData }
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│          Supabase Edge Function (generate-lease-pdf/index.ts)           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Authenticate user                                              │  │
│  │ 2. Build text annotations (buildPdfCoAnnotations)                 │  │
│  │ 3. Build signature fields (buildSignatureFields)                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ 3. POST https://api.pdf.co/v1/pdf/edit/add
                 │    x-api-key: <PDFCO_API_KEY>
                 │    Body: { url, annotations, fields }
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           PDF.co API                                     │
│  1. Fetches template PDF from LEASE_TEMPLATE_URL                        │
│  2. Adds text annotations (landlords, tenants, rent, etc.)              │
│  3. Adds signature fields (editable AcroForm)                           │
│  4. Returns generated PDF URL                                            │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ 4. Returns { url: "https://pdf.co/temp/..." }
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│          Edge Function (continued)                                       │
│  1. Downloads PDF from PDF.co URL                                        │
│  2. Uploads to Supabase Storage (storePdf)                               │
│  3. Updates lease record with document_url                               │
│  4. Creates document version record (optional)                           │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ 5. { success: true, documentUrl, ... }
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Supabase Storage                                    │
│  Bucket: lease-documents                                                 │
│  Path: leases/{userId}/lease-{leaseId}-{timestamp}.pdf                  │
│  Public URL: https://{project}.supabase.co/storage/v1/object/...        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐
│  Form Data   │
│ (from app)   │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│ OntarioLeaseFormData                                           │
│ ┌────────────────┬─────────────────┬──────────────────┐       │
│ │  landlords     │   tenants       │  rentalUnit      │       │
│ │  (up to 4)     │   (up to 12)    │  contact         │       │
│ │                │                 │  term            │       │
│ └────────────────┴─────────────────┴──────────────────┘       │
│ ┌────────────────┬─────────────────┬──────────────────┐       │
│ │  rent          │   utilities     │  services        │       │
│ │  deposits      │   smoking       │  insurance       │       │
│ │  additionalTerms                                     │       │
│ └──────────────────────────────────────────────────────┘       │
└──────┬─────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│ buildPdfCoAnnotations()                                        │
│ Converts form data to PDF.co text annotations:                 │
│                                                                 │
│ landlords[0].legalName → { x:100, y:100, text:"John Smith" }  │
│ tenants[0].firstName   → { x:100, y:200, text:"Alice" }       │
│ rent.total             → { x:100, y:280, text:"$2,000.00" }   │
│ ... (100+ annotations)                                         │
└──────┬─────────────────────────────────────────────────────────┘
       │
       │
┌──────┴─────────────────────────────────────────────────────────┐
│ buildSignatureFields()                                         │
│ Creates editable signature fields:                             │
│                                                                 │
│ landlord_sig_1 → { fieldType:"signature", x:50, y:150 }       │
│ landlord_date_1 → { fieldType:"text", x:270, y:155 }          │
│ tenant_sig_1   → { fieldType:"signature", x:50, y:400 }       │
│ ... (up to 64 fields: 4 landlords × 8 + 12 tenants × 8)       │
└──────┬─────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│                      PDF.co Request                            │
│ {                                                              │
│   "url": "https://your-url.com/ontario-lease-template.pdf",   │
│   "name": "ontario-lease-123.pdf",                            │
│   "annotations": [...],  // Text overlays                     │
│   "fields": [...],       // Signature fields                  │
│   "async": false                                               │
│ }                                                              │
└──────┬─────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│                    Generated PDF                               │
│                                                                 │
│  Page 1: Parties, Rental Unit, Contact                        │
│  Page 2: Term, Rent                                           │
│  Page 3: Services, Utilities                                  │
│  Page 4: Discounts, Deposits                                  │
│  Page 5: Smoking, Insurance                                   │
│  Page 6: Additional Terms                                     │
│  Page 7: Signatures (editable fields) ✍                       │
└────────────────────────────────────────────────────────────────┘
```

## Component Interaction

```
┌────────────────────────────────────────────────────────────────────┐
│                        User Interface                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Lease Form   │  │ Preview      │  │ Signature    │           │
│  │ (input data) │→│ (review)     │→│ (send)       │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└────────┬───────────────────────────────────────────────────────────┘
         │
         │ Form data submitted
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                   Application Logic                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ leaseStore.ts                                                │ │
│  │ - Manages form state                                         │ │
│  │ - Builds formData object                                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ lease-generation-service.ts                                  │ │
│  │ - validateFormData()                                         │ │
│  │ - generateLeasePdf()                                         │ │
│  │ - sendLeaseToTenant()                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────┬───────────────────────────────────────────────────────────┘
         │
         │ HTTP POST with auth token
         ▼
┌────────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Serverless)                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Main Handler                                                 │ │
│  │ - Authenticate request                                       │ │
│  │ - Parse JSON body                                            │ │
│  │ - Call generateLeaseWithPdfCo()                              │ │
│  └──────┬───────────────────────────────────────────────────────┘ │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Data Transformation                                          │ │
│  │ - buildPdfCoAnnotations() → Text overlays                   │ │
│  │ - buildSignatureFields() → Form fields                      │ │
│  │ - Helper functions (checkbox, formatDate, formatCurrency)   │ │
│  └──────┬───────────────────────────────────────────────────────┘ │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ External API Call                                            │ │
│  │ - POST to PDF.co                                             │ │
│  │ - Download generated PDF                                     │ │
│  └──────┬───────────────────────────────────────────────────────┘ │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Storage & Database                                           │ │
│  │ - storePdf() → Upload to Supabase Storage                   │ │
│  │ - Update leases table                                        │ │
│  │ - Create lease_documents record (optional)                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────┬───────────────────────────────────────────────────────────┘
         │
         │ Return document URL
         ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Response                                    │
│  {                                                                 │
│    "success": true,                                                │
│    "documentUrl": "https://...supabase.co/storage/.../lease.pdf", │
│    "documentId": "leases/user-id/lease-123-1234567890.pdf",       │
│    "version": 1,                                                   │
│    "engineUsed": "pdfco"                                           │
│  }                                                                 │
└────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────┐
│  Request Received   │
└──────────┬──────────┘
           │
           ▼
     ┌─────────────────┐
     │ Auth Check      │────────→ 401 Unauthorized
     └──────┬──────────┘
            │
            ▼
     ┌─────────────────┐
     │ Validate Input  │────────→ 400 Bad Request
     └──────┬──────────┘
            │
            ▼
     ┌─────────────────┐
     │ Check Config    │────────→ PDFCO_NOT_CONFIGURED
     │ (API key, URL)  │
     └──────┬──────────┘
            │
            ▼
     ┌─────────────────┐
     │ Call PDF.co     │────────→ PDFCO_API_ERROR
     └──────┬──────────┘          (401, 402, 404, etc.)
            │
            ▼
     ┌─────────────────┐
     │ Download PDF    │────────→ PDFCO_DOWNLOAD_FAILED
     └──────┬──────────┘
            │
            ▼
     ┌─────────────────┐
     │ Upload Storage  │────────→ STORAGE_UPLOAD_FAILED
     └──────┬──────────┘
            │
            ▼
     ┌─────────────────┐
     │ Update Database │────────→ Warning (non-fatal)
     └──────┬──────────┘
            │
            ▼
     ┌─────────────────┐
     │ Return Success  │
     │ with URL        │
     └─────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Development                               │
│                                                                 │
│  Local Machine                                                  │
│  ├── Aralink/                                                   │
│  │   ├── supabase/functions/generate-lease-pdf/                │
│  │   │   └── index.ts                                           │
│  │   └── services/lease-generation-service.ts                  │
│  │                                                              │
│  │   Deploy via CLI:                                           │
│  │   $ supabase functions deploy generate-lease-pdf            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Deploy
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Cloud                               │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Edge Functions (Deno Runtime)                              ││
│  │ - generate-lease-pdf function                              ││
│  │ - Auto-scaling                                             ││
│  │ - Global edge locations                                    ││
│  └────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Secrets Manager                                            ││
│  │ - PDFCO_API_KEY (encrypted)                                ││
│  │ - LEASE_TEMPLATE_URL                                       ││
│  └────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Storage                                                    ││
│  │ - Bucket: lease-documents                                  ││
│  │ - Public access with RLS                                   ││
│  └────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Database (PostgreSQL)                                      ││
│  │ - leases table                                             ││
│  │ - lease_documents table (optional)                        ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ Calls external API
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PDF.co Cloud                               │
│                                                                 │
│  - Receives template URL                                        │
│  - Processes annotations and fields                             │
│  - Returns generated PDF                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

```
┌─────────────┐
│   Client    │ (React Native App)
└──────┬──────┘
       │ 1. User authentication
       │    (Supabase Auth JWT)
       ▼
┌─────────────────────────┐
│  Edge Function          │
│  - Validates JWT        │──────→ Rejects if invalid/expired
│  - Extracts user.id     │
└──────┬──────────────────┘
       │ 2. Authorized request
       ▼
┌─────────────────────────┐
│  PDF.co API             │
│  - Uses server API key  │──────→ Not exposed to client
│  - Server-to-server     │
└──────┬──────────────────┘
       │ 3. Generated PDF
       ▼
┌─────────────────────────┐
│  Supabase Storage       │
│  - Stores in user folder│
│  - RLS: User can only   │
│    access own files     │
└─────────────────────────┘
```

---

**Legend**:
- `→` = Data flow / Action
- `▼` = Sequential process
- `┌─┘` = Component/system boundary
