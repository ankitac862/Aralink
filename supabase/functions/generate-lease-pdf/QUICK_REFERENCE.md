# Quick Reference Card

## 🚀 Quick Start (5 Steps)

```bash
# 1. Get PDF.co API key from https://pdf.co
# 2. Upload your Ontario Lease template PDF to a public URL

# 3. Set secrets
supabase secrets set PDFCO_API_KEY=your_api_key_here
supabase secrets set LEASE_TEMPLATE_URL=https://your-url.com/template.pdf

# 4. Deploy
cd Aralink
supabase functions deploy generate-lease-pdf

# 5. Test
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/generate-lease-pdf" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

## 📊 Data Structure Quick Reference

```typescript
{
  landlords: [{ legalName: "John Smith" }],  // Max 4
  tenants: [{ firstName: "Alice", lastName: "Johnson" }],  // Max 12
  rentalUnit: {
    streetNumber: "123", streetName: "Main St",
    city: "Toronto", province: "ON", postalCode: "M5V 2N2",
    parkingSpaces: 1, isCondo: true
  },
  contact: {
    noticeAddress: "...", emailConsent: true,
    emails: ["..."], emergencyContact: "..."
  },
  term: {
    startDate: "2026-02-01", type: "fixed", endDate: "2027-02-01"
  },
  rent: {
    dueDay: 1, frequency: "monthly", base: 2000, total: 2000,
    payableTo: "...", paymentMethods: ["e-transfer"]
  },
  utilities: { electricity: "tenant", heat: "landlord", water: "landlord" },
  services: { gas: true, airConditioning: true, storage: true },
  deposits: { rentDepositRequired: true, rentDepositAmount: 2000 },
  smoking: { hasRules: true, rulesDescription: "..." },
  insurance: { required: true },
  additionalTerms: { hasAdditionalTerms: true, description: "..." }
}
```

## 🎯 Common Tasks

### Generate PDF
```typescript
import { generateLeasePdf } from '@/services/lease-generation-service';
const result = await generateLeasePdf(leaseId, formData);
```

### View Logs
```bash
supabase functions logs generate-lease-pdf --follow
```

### Adjust Position
```typescript
// In buildPdfCoAnnotations() function
annotations.push({
  x: 100,      // ← Move left/right
  y: 200,      // ← Move up/down
  text: "...",
  fontName: "Helvetica",
  fontSize: 10, // ← Change size
  pages: "0"   // ← Page number (0-indexed)
});
```

### Debug Alignment
1. Generate test PDF
2. Measure offset from correct position
3. Adjust X/Y coordinates by that offset
4. Regenerate and verify

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PDFCO_API_KEY` | ✅ Yes | Your PDF.co API key |
| `LEASE_TEMPLATE_URL` | ✅ Yes | URL to Ontario Lease template PDF |
| `SUPABASE_URL` | Auto | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Service role key |

## 📄 Files Overview

| File | Purpose | Lines |
|------|---------|-------|
| `index.ts` | Main implementation | 1,200 |
| `README.md` | Complete documentation | - |
| `DEPLOYMENT.md` | Deployment steps | - |
| `FIELD_POSITIONS.md` | Position configuration | - |
| `MIGRATION.md` | Migration guide | - |
| `TEST_DATA.md` | Sample test cases | - |
| `SUMMARY.md` | Implementation summary | - |

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "API key not configured" | `supabase secrets set PDFCO_API_KEY=...` |
| "Template URL not configured" | `supabase secrets set LEASE_TEMPLATE_URL=...` |
| "Failed to fetch template" | Verify URL is publicly accessible |
| "Storage upload failed" | Check `lease-documents` bucket exists |
| Text misaligned | Adjust X/Y in `buildPdfCoAnnotations()` |
| PDF.co 402 error | Add credits to PDF.co account |

## 💰 Costs

- **Free tier**: 100 PDFs/month
- **Starter**: $9.99/mo (1,000 PDFs)
- **Professional**: $39.99/mo (5,000 PDFs)

## 📐 Page Layout

```
Letter Size: 612 × 792 points (8.5" × 11")
Margins: 54pt each side (0.75")
Content Area: 504 × 684 points

Page Mapping:
- Page 0 = Page 1: Sections 1-3
- Page 1 = Page 2: Sections 4-5
- Page 2 = Page 3: Section 6
- Page 3 = Page 4: Sections 7-9
- Page 4 = Page 5: Sections 10-11
- Page 5 = Page 6: Section 15
- Page 6 = Page 7: Section 17 (Signatures)
```

## ✅ Pre-Deployment Checklist

- [ ] PDF.co account created
- [ ] API key obtained
- [ ] Template PDF uploaded
- [ ] Template URL is public
- [ ] Secrets configured
- [ ] Function deployed
- [ ] Storage bucket created
- [ ] Storage policies set
- [ ] Test with sample data
- [ ] Verify field alignment
- [ ] Check signature fields work

## 📞 Support

- PDF.co: https://pdf.co/support
- Supabase: https://discord.supabase.com
- Docs: See README.md

## 🔄 Quick Commands

```bash
# Deploy
supabase functions deploy generate-lease-pdf

# View logs
supabase functions logs generate-lease-pdf

# Set secret
supabase secrets set KEY=value

# List secrets
supabase secrets list

# Create storage bucket
supabase storage create lease-documents --public
```

---

**Need More Help?** See the full documentation files in this directory.
