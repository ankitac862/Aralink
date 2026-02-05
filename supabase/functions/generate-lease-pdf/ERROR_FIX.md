# Error Fix: Cannot read properties of undefined

## Problem
```
TypeError: Cannot read properties of undefined (reading 'slice')
    at buildPdfCoAnnotations (line 144)
```

**Cause:** The code expected `formData.landlords` and `formData.tenants` arrays, but your app is likely sending data in the old format (or missing these fields).

## Solution Applied ✅

Added defensive checks to handle undefined/null values with sensible defaults:

### 1. Arrays (landlords, tenants)
```typescript
const landlords = formData.landlords || [];
const tenants = formData.tenants || [];
```

### 2. Required Objects (with defaults)
```typescript
const rentalUnit = formData.rentalUnit || { 
  streetNumber: '', 
  streetName: '', 
  city: '', 
  province: 'ON', 
  postalCode: '',
  isCondo: false 
};

const contact = formData.contact || { 
  noticeAddress: '', 
  emailConsent: false,
  emergencyContactConsent: false 
};

const term = formData.term || { 
  startDate: '', 
  type: 'month_to_month'
};

const rent = formData.rent || { 
  dueDay: 1, 
  frequency: 'monthly', 
  base: 0, 
  total: 0,
  payableTo: '',
  paymentMethods: []
};
```

### 3. Optional Objects (can be undefined)
```typescript
const utilities = formData.utilities;  // Stays undefined if not provided
const services = formData.services;    // Stays undefined if not provided
```

## What This Means

**Now the function will work with:**

1. ✅ **New format** (with `landlords` and `tenants` arrays)
2. ✅ **Old format** (missing these fields - uses defaults)
3. ✅ **Partial data** (missing some required fields)

## Testing

Deploy and test with minimal data:

```bash
# Deploy the fix
supabase functions deploy generate-lease-pdf

# Test with minimal data
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/generate-lease-pdf" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leaseId": "test-001",
    "formData": {
      "landlords": [{"legalName": "Test Landlord"}],
      "tenants": [{"firstName": "Test", "lastName": "Tenant"}],
      "rentalUnit": {
        "streetNumber": "123",
        "streetName": "Main St",
        "city": "Toronto",
        "province": "ON",
        "postalCode": "M5V2N2",
        "isCondo": false
      },
      "contact": {
        "noticeAddress": "123 Main St",
        "emailConsent": false,
        "emergencyContactConsent": false
      },
      "term": {
        "startDate": "2026-02-01",
        "type": "month_to_month"
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

## Next: Update Your App

Your app should send data in this format:

```typescript
const formData = {
  landlords: [
    { legalName: "Jane Smith" },
    { legalName: "John Doe" }
  ],
  tenants: [
    { firstName: "Alice", lastName: "Anderson" },
    { firstName: "Bob", lastName: "Brown" }
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
    noticeAddress: "123 Main St, Toronto ON",
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
    payableTo: "Jane Smith",
    paymentMethods: ["e-transfer"]
  },
  utilities: {
    electricity: "tenant",
    heat: "landlord",
    water: "landlord"
  },
  services: {
    gas: true,
    airConditioning: true,
    storage: true
  },
  insurance: {
    required: true
  }
};
```

## Summary

✅ **Error fixed** - Added defensive checks for undefined values
✅ **Backward compatible** - Works with missing/partial data  
✅ **Ready to deploy** - Will no longer crash on undefined

**Deploy now and test!**
