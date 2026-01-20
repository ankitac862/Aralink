# 🚨 CRITICAL FIX NEEDED

## Problem
Your Edge Function is using the WRONG PDF.co endpoint!

**Current (WRONG):**
```typescript
const PDFCO_FILL_FORM_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/add';
```

**Should be:**
```typescript
const PDFCO_FILL_FORM_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/fill-form';
```

## Why It's Broken
- `/pdf/edit/add` = Adds NEW text on top of PDF (doesn't fill existing form fields)
- `/pdf/edit/fill-form` = Fills EXISTING form fields in the PDF

## Also Fix the Request Body

The `/fill-form` endpoint expects DIFFERENT parameters:

**Current (WRONG):**
```typescript
{
  url: TEMPLATE_URL,
  name: `ontario-lease-${leaseId}`,
  fields: [...], // Array with "pages" and "text"
  async: false,
}
```

**Should be:**
```typescript
{
  url: TEMPLATE_URL,
  fields: {...}, // OBJECT with fieldName: value pairs
  flatten: true,
  async: false,
}
```

## Complete Fix

Replace your `tryTemplateFilling` function's fetch call (around line 350):

```typescript
const fillResponse = await fetch(PDFCO_FILL_FORM_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': PDFCO_API_KEY,
  },
  body: JSON.stringify({
    url: TEMPLATE_URL,
    fields: buildFieldMappingAsObject(formData), // ← Use object format
    flatten: true,
    async: false,
  }),
});
```

And update `buildFieldMapping` to return an OBJECT:

```typescript
function buildFieldMappingAsObject(formData: OntarioLeaseFormData): Record<string, string> {
  const totalRent = (formData.baseRent || 0) + 
                    (formData.parkingRent || 0) + 
                    (formData.otherServicesRent || 0);

  const getTenantParts = (index: number) => {
    const name = formData.tenantNames[index] || '';
    const parts = name.trim().split(' ');
    return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
  };

  const tenant1 = getTenantParts(0);

  return {
    // Section 1
    'Landlords Legal Name': formData.landlordName,
    'Text1': formData.landlordName,
    'Last Name': tenant1.last,
    'First Name': tenant1.first,
    
    // Section 2
    'Unit eg unit 1 or basement unit': formData.unitAddress.unit || '',
    'Street Number': formData.unitAddress.streetNumber,
    'Street Name': formData.unitAddress.streetName,
    'CityTown': formData.unitAddress.city,
    'Province': formData.unitAddress.province,
    'Postal Code': formData.unitAddress.postalCode,
    
    // Section 4 - Term
    'Date yyyymmdd': formData.tenancyStartDate,
    
    // Section 5 - Rent
    'Text16': formData.baseRent.toFixed(2),
    'Text17': (formData.parkingRent || 0).toFixed(2),
    'Text18': (formData.otherServicesRent || 0).toFixed(2),
    'Text19': totalRent.toFixed(2),
    'Text20': formData.rentPayableTo,
    
    // Add more fields as needed...
  };
}
```

## Quick Steps

1. Change line 7 from `/add` to `/fill-form`
2. Replace `buildFieldMapping` to return an object
3. Update the fetch body to use the object
4. Redeploy the function

Then your PDF will actually have filled fields! 🎉
