# Sample Test Data for Ontario Lease PDF Generation

This file contains sample data for testing the PDF generation with various scenarios.

## Test Case 1: Minimal Required Fields

```json
{
  "leaseId": "test-minimal-001",
  "formData": {
    "landlords": [
      { "legalName": "Jane Smith" }
    ],
    "tenants": [
      { "firstName": "John", "lastName": "Doe" }
    ],
    "rentalUnit": {
      "streetNumber": "123",
      "streetName": "Main Street",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5V 2N2",
      "isCondo": false
    },
    "contact": {
      "noticeAddress": "123 Main Street, Toronto, ON M5V 2N2",
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
      "payableTo": "Jane Smith",
      "paymentMethods": ["e-transfer"]
    }
  }
}
```

## Test Case 2: Maximum Parties (4 Landlords, 12 Tenants)

```json
{
  "leaseId": "test-maximum-002",
  "formData": {
    "landlords": [
      { "legalName": "Property Management Corporation Inc." },
      { "legalName": "John Smith" },
      { "legalName": "Mary Johnson" },
      { "legalName": "Toronto Real Estate Holdings Ltd." }
    ],
    "tenants": [
      { "firstName": "Alice", "lastName": "Anderson" },
      { "firstName": "Bob", "lastName": "Brown" },
      { "firstName": "Charlie", "lastName": "Chen" },
      { "firstName": "Diana", "lastName": "Davis" },
      { "firstName": "Edward", "lastName": "Evans" },
      { "firstName": "Fiona", "lastName": "Foster" },
      { "firstName": "George", "lastName": "Garcia" },
      { "firstName": "Hannah", "lastName": "Harris" },
      { "firstName": "Ian", "lastName": "Ivanov" },
      { "firstName": "Julia", "lastName": "Jackson" },
      { "firstName": "Kevin", "lastName": "Kim" },
      { "firstName": "Laura", "lastName": "Lopez" }
    ],
    "rentalUnit": {
      "unit": "Penthouse 1",
      "streetNumber": "9999",
      "streetName": "Very Long Street Name Boulevard Avenue",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5V 2N2",
      "parkingSpaces": 5,
      "isCondo": true
    },
    "contact": {
      "noticeAddress": "Property Management Office, 100 King Street West, Suite 500, Toronto, ON M5X 1A1",
      "emailConsent": true,
      "emails": ["manager@propmgmt.com", "office@propmgmt.com", "legal@propmgmt.com"],
      "emergencyContactConsent": true,
      "emergencyContact": "24/7 Emergency Line: 416-555-9999"
    },
    "term": {
      "startDate": "2026-03-01",
      "type": "fixed",
      "endDate": "2028-02-28"
    },
    "rent": {
      "dueDay": 1,
      "frequency": "monthly",
      "base": 8500,
      "parking": 500,
      "otherServices": 200,
      "total": 9200,
      "payableTo": "Property Management Corporation Inc.",
      "paymentMethods": ["e-transfer", "cheque", "debit"],
      "nsfFee": 50,
      "partial": {
        "amount": 5000,
        "fromDate": "2026-03-01",
        "toDate": "2026-03-15"
      }
    },
    "utilities": {
      "electricity": "tenant",
      "heat": "landlord",
      "water": "landlord",
      "utilityDetails": "Tenant responsible for setting up and paying electricity account directly with utility provider."
    },
    "services": {
      "gas": true,
      "airConditioning": true,
      "storage": true,
      "laundry": "included",
      "guestParking": "free",
      "otherServices": "Concierge service, gym, pool, party room",
      "utilityDetails": "All utilities included except electricity"
    },
    "discounts": {
      "hasDiscount": true,
      "description": "First month 50% off ($4,250) if lease signed before February 1, 2026"
    },
    "deposits": {
      "rentDepositRequired": true,
      "rentDepositAmount": 9200,
      "keyDepositRequired": true,
      "keyDepositAmount": 100,
      "keyDepositDescription": "For 5 keys, 3 parking fobs, and 1 storage locker key"
    },
    "smoking": {
      "hasRules": true,
      "rulesDescription": "No smoking anywhere in the building, including balconies and common areas. $500 fine for violations."
    },
    "insurance": {
      "required": true
    },
    "additionalTerms": {
      "hasAdditionalTerms": true,
      "description": "Tenant must maintain tenant insurance with minimum $2,000,000 liability coverage. Proof of insurance must be provided within 14 days of lease signing. Tenant responsible for HVAC filter changes every 3 months. No subletting without written landlord approval."
    }
  }
}
```

## Test Case 3: Condo with Typical Setup

```json
{
  "leaseId": "test-condo-003",
  "formData": {
    "landlords": [
      { "legalName": "Sarah Williams" }
    ],
    "tenants": [
      { "firstName": "Emily", "lastName": "Martinez" },
      { "firstName": "David", "lastName": "Lee" }
    ],
    "rentalUnit": {
      "unit": "Unit 1204",
      "streetNumber": "25",
      "streetName": "The Esplanade",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5E 1W5",
      "parkingSpaces": 1,
      "isCondo": true
    },
    "contact": {
      "noticeAddress": "25 The Esplanade, Unit 1204, Toronto, ON M5E 1W5",
      "emailConsent": true,
      "emails": ["sarah.williams@email.com"],
      "emergencyContactConsent": true,
      "emergencyContact": "416-555-7890"
    },
    "term": {
      "startDate": "2026-04-01",
      "type": "fixed",
      "endDate": "2027-03-31"
    },
    "rent": {
      "dueDay": 1,
      "frequency": "monthly",
      "base": 2800,
      "parking": 150,
      "total": 2950,
      "payableTo": "Sarah Williams",
      "paymentMethods": ["e-transfer"],
      "nsfFee": 25
    },
    "utilities": {
      "electricity": "tenant",
      "heat": "landlord",
      "water": "landlord",
      "utilityDetails": "Electricity billed separately by building management"
    },
    "services": {
      "gas": false,
      "airConditioning": true,
      "storage": true,
      "laundry": "included",
      "guestParking": "paid",
      "otherServices": "Gym and party room included in condo fees"
    },
    "deposits": {
      "rentDepositRequired": true,
      "rentDepositAmount": 2950,
      "keyDepositRequired": true,
      "keyDepositAmount": 50,
      "keyDepositDescription": "For 2 keys and 1 parking fob"
    },
    "smoking": {
      "hasRules": true,
      "rulesDescription": "No smoking in unit or on balcony as per condo rules"
    },
    "insurance": {
      "required": true
    },
    "additionalTerms": {
      "hasAdditionalTerms": true,
      "description": "Tenant must follow all condominium corporation rules and bylaws. Copy of condo declaration and rules provided to tenant."
    }
  }
}
```

## Test Case 4: Weekly Rental

```json
{
  "leaseId": "test-weekly-004",
  "formData": {
    "landlords": [
      { "legalName": "Michael Brown" }
    ],
    "tenants": [
      { "firstName": "Temporary", "lastName": "Worker" }
    ],
    "rentalUnit": {
      "streetNumber": "45",
      "streetName": "Oak Street",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M6J 2E2",
      "isCondo": false
    },
    "contact": {
      "noticeAddress": "45 Oak Street, Toronto, ON M6J 2E2",
      "emailConsent": true,
      "emails": ["michael.brown@email.com"],
      "emergencyContactConsent": true,
      "emergencyContact": "416-555-4567"
    },
    "term": {
      "startDate": "2026-02-01",
      "type": "other",
      "otherDescription": "Short-term rental for 12 weeks with option to extend"
    },
    "rent": {
      "dueDay": 1,
      "frequency": "weekly",
      "base": 500,
      "total": 500,
      "payableTo": "Michael Brown",
      "paymentMethods": ["cash", "e-transfer"]
    },
    "utilities": {
      "electricity": "landlord",
      "heat": "landlord",
      "water": "landlord"
    },
    "deposits": {
      "rentDepositRequired": false,
      "keyDepositRequired": true,
      "keyDepositAmount": 20,
      "keyDepositDescription": "For 1 key"
    },
    "insurance": {
      "required": false
    }
  }
}
```

## Test Case 5: Student Rental (Multiple Tenants, Specific Rules)

```json
{
  "leaseId": "test-student-005",
  "formData": {
    "landlords": [
      { "legalName": "University Housing Partners Ltd." }
    ],
    "tenants": [
      { "firstName": "Student", "lastName": "One" },
      { "firstName": "Student", "lastName": "Two" },
      { "firstName": "Student", "lastName": "Three" },
      { "firstName": "Student", "lastName": "Four" }
    ],
    "rentalUnit": {
      "streetNumber": "789",
      "streetName": "College Street",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5T 1R4",
      "isCondo": false
    },
    "contact": {
      "noticeAddress": "Property Management Office, 100 Spadina Avenue, Toronto, ON M5T 2C2",
      "emailConsent": true,
      "emails": ["rentals@unihousing.com"],
      "emergencyContactConsent": true,
      "emergencyContact": "24/7 Hotline: 416-555-0000"
    },
    "term": {
      "startDate": "2026-09-01",
      "type": "fixed",
      "endDate": "2027-08-31"
    },
    "rent": {
      "dueDay": 1,
      "frequency": "monthly",
      "base": 3200,
      "total": 3200,
      "payableTo": "University Housing Partners Ltd.",
      "paymentMethods": ["e-transfer"],
      "nsfFee": 30
    },
    "utilities": {
      "electricity": "landlord",
      "heat": "landlord",
      "water": "landlord",
      "utilityDetails": "All utilities included in rent"
    },
    "services": {
      "laundry": "coin",
      "otherServices": "Coin laundry in basement"
    },
    "discounts": {
      "hasDiscount": true,
      "description": "Early bird discount: $100 off first month if signed before June 1"
    },
    "deposits": {
      "rentDepositRequired": true,
      "rentDepositAmount": 3200,
      "keyDepositRequired": true,
      "keyDepositAmount": 80,
      "keyDepositDescription": "For 4 sets of keys ($20 each)"
    },
    "smoking": {
      "hasRules": true,
      "rulesDescription": "No smoking in unit or anywhere on property"
    },
    "insurance": {
      "required": true
    },
    "additionalTerms": {
      "hasAdditionalTerms": true,
      "description": "Quiet hours 11pm-7am. No parties over 10 people without prior approval. Tenants jointly and severally liable for rent."
    }
  }
}
```

## Test Case 6: Edge Cases (Testing Validation)

### 6a. Missing Required Fields
```json
{
  "leaseId": "test-invalid-001",
  "formData": {
    "landlords": [],
    "tenants": [],
    "rentalUnit": {
      "streetNumber": "",
      "streetName": "",
      "city": "",
      "province": "",
      "postalCode": "",
      "isCondo": false
    }
  }
}
```
**Expected**: Validation error

### 6b. Too Many Parties
```json
{
  "leaseId": "test-invalid-002",
  "formData": {
    "landlords": [
      { "legalName": "Landlord 1" },
      { "legalName": "Landlord 2" },
      { "legalName": "Landlord 3" },
      { "legalName": "Landlord 4" },
      { "legalName": "Landlord 5" }
    ],
    "tenants": [
      ...13 tenants...
    ]
  }
}
```
**Expected**: Only first 4 landlords and 12 tenants rendered

## Using These Tests

### Via curl

```bash
# Save test case to file
cat > test-data.json << 'EOF'
{
  "leaseId": "test-001",
  "formData": { ... }
}
EOF

# Run test
curl -X POST \
  "https://your-project.supabase.co/functions/v1/generate-lease-pdf" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

### Via TypeScript

```typescript
import { generateLeasePdf } from '@/services/lease-generation-service';
import testData from './test-data.json';

const result = await generateLeasePdf(
  testData.leaseId,
  testData.formData
);

console.log(result.success ? 'Success!' : `Error: ${result.error}`);
```

### Via Postman

1. Import the test cases into Postman
2. Set up environment variables for your Supabase URL and keys
3. Run the collection

## Validation Checklist

When testing each case, verify:

- [ ] PDF generates without errors
- [ ] All landlords appear (up to 4)
- [ ] All tenants appear (up to 12)
- [ ] Address is complete and formatted correctly
- [ ] Rent amounts are formatted as currency
- [ ] Dates are in correct format
- [ ] Checkboxes render: ☑ vs ☐
- [ ] Optional fields don't show "undefined"
- [ ] Signature fields are editable
- [ ] PDF is exactly 7 pages
- [ ] Long text doesn't overflow
- [ ] Special characters render correctly

## Performance Benchmarks

Expected generation times:

- Minimal data: 2-4 seconds
- Maximum data: 3-5 seconds
- Typical data: 2-4 seconds

If generation takes longer than 10 seconds, check:
- PDF.co API status
- Template URL accessibility
- Network latency
