# PDF Template Field Positions Configuration

This document helps you configure the exact positions for your Ontario Lease Form 2229E template.

## How to Find Coordinates

### Method 1: PDF.co Coordinate Finder
1. Go to https://pdf.co/playground
2. Upload your template PDF
3. Use the visual editor to place text and note the X, Y coordinates

### Method 2: Adobe Acrobat
1. Open PDF in Acrobat
2. Tools → Measure → Point
3. Click on the location to get coordinates
4. **Note**: Y coordinates in PDF start from bottom-left, but PDF.co uses top-left

### Method 3: Trial and Error
1. Start with estimated positions
2. Generate a test PDF
3. Adjust coordinates based on output
4. Repeat until aligned

## Page Layout Reference

```
Letter Size (8.5" × 11" = 612 × 792 points)

┌─────────────────────────────────────┐
│ (0, 0)                    (612, 0)  │  Top
│                                     │
│                                     │
│                                     │
│           Content Area              │
│                                     │
│                                     │
│                                     │
│ (0, 792)                (612, 792)  │  Bottom
└─────────────────────────────────────┘

Margins (typical):
- Top: 54 points (0.75")
- Bottom: 54 points
- Left: 54 points
- Right: 54 points

Content area: 504 × 684 points
```

## Section Positions Template

Copy this to your implementation and fill in the actual values:

```typescript
// Field Position Configuration
const FIELD_POSITIONS = {
  // ==================== PAGE 1 ====================
  page1: {
    // Section 1: Parties
    landlord: {
      startY: 100,  // Y position for first landlord
      lineHeight: 20,  // Space between multiple landlords
      x: 100,
    },
    tenant: {
      startY: 200,  // Y position for first tenant
      columns: 3,   // Number of columns for tenant grid
      columnWidth: 180,
      rowHeight: 15,
      x: 100,
    },
    
    // Section 2: Rental Unit
    address: {
      unit: { x: 100, y: 350 },
      street: { x: 150, y: 350 },
      cityProvincePostal: { x: 100, y: 370 },
      parking: { x: 100, y: 390 },
      condoCheckbox: { x: 100, y: 410 },
    },
    
    // Section 3: Contact
    contact: {
      noticeAddress: { x: 100, y: 450 },
      emailConsent: { x: 100, y: 470 },
      emails: { x: 150, y: 470 },
      emergencyContact: { x: 100, y: 490 },
    },
  },
  
  // ==================== PAGE 2 ====================
  page2: {
    // Section 4: Term
    term: {
      startDate: { x: 100, y: 100 },
      termType: { x: 100, y: 120 },
      endDate: { x: 100, y: 140 },
    },
    
    // Section 5: Rent
    rent: {
      dueDay: { x: 100, y: 200 },
      baseRent: { x: 100, y: 220 },
      parking: { x: 100, y: 240 },
      otherServices: { x: 100, y: 260 },
      total: { x: 100, y: 280 },
      payableTo: { x: 100, y: 300 },
      paymentMethods: { x: 100, y: 320 },
      nsfFee: { x: 100, y: 340 },
      partialRent: { x: 100, y: 360 },
    },
  },
  
  // ==================== PAGE 3 ====================
  page3: {
    // Section 6: Services & Utilities
    utilities: {
      electricity: { x: 100, y: 100 },
      heat: { x: 100, y: 120 },
      water: { x: 100, y: 140 },
      details: { x: 100, y: 160 },
    },
    
    services: {
      startY: 200,
      lineHeight: 20,
      x: 100,
    },
    
    // Section 7: Discounts
    discounts: {
      description: { x: 100, y: 400 },
    },
    
    // Section 8: Rent Deposit
    rentDeposit: {
      amount: { x: 100, y: 450 },
    },
    
    // Section 9: Key Deposit
    keyDeposit: {
      amount: { x: 100, y: 500 },
      description: { x: 100, y: 520 },
    },
  },
  
  // ==================== PAGE 4 ====================
  page4: {
    // Section 10: Smoking
    smoking: {
      rules: { x: 100, y: 100 },
    },
    
    // Section 11: Insurance
    insurance: {
      required: { x: 100, y: 150 },
    },
  },
  
  // ==================== PAGE 5 ====================
  page5: {
    // Section 15: Additional Terms
    additionalTerms: {
      description: { x: 100, y: 100 },
    },
  },
  
  // ==================== PAGE 6 (Signature Page) ====================
  page6: {
    // Section 17: Signatures
    landlordSignatures: {
      startY: 150,
      rowHeight: 60,
      signature: {
        x: 50,
        width: 200,
        height: 40,
      },
      date: {
        x: 270,
        width: 100,
        height: 30,
      },
    },
    
    tenantSignatures: {
      startY: 400,
      rowHeight: 60,
      columns: 2,
      columnWidth: 280,
      signature: {
        x: 50,
        width: 150,
        height: 35,
      },
      date: {
        xOffset: 160,  // Offset from signature X
        width: 80,
        height: 25,
      },
    },
  },
};
```

## Font Sizes Reference

```typescript
const FONT_SIZES = {
  heading: 12,
  sectionTitle: 11,
  normalText: 10,
  smallText: 9,
  tinyText: 8,
  checkbox: 12,
};
```

## Testing Checklist

Use this checklist when testing your PDF generation:

### Visual Alignment
- [ ] Landlord names align with form fields
- [ ] Tenant names fit in designated area (grid layout works for 12 tenants)
- [ ] Address components align correctly
- [ ] Checkboxes appear in correct positions
- [ ] Monetary amounts align with $ symbols
- [ ] Date fields are positioned correctly
- [ ] Multi-line text doesn't overflow

### Content Validation
- [ ] All landlords appear (up to 4)
- [ ] All tenants appear (up to 12)
- [ ] Currency formatted correctly ($X,XXX.XX)
- [ ] Dates formatted correctly (YYYY-MM-DD or locale format)
- [ ] Checkboxes render: ☑ (checked) vs ☐ (unchecked)
- [ ] Long text wraps appropriately
- [ ] Optional fields don't show "undefined" or null

### Signature Section
- [ ] Landlord signature fields are editable
- [ ] Tenant signature fields are editable
- [ ] Labels show correct names
- [ ] Date fields are text inputs (not signature fields)
- [ ] Layout accommodates maximum number of parties

### Page Breaks
- [ ] Content doesn't overlap page boundaries
- [ ] All 7 pages are present
- [ ] No blank pages
- [ ] Sections appear on correct pages

## Common Adjustments

### Text Too Low/High
```typescript
// If text is too low, decrease Y value
// If text is too high, increase Y value
y: 100  // Original
y: 90   // Move up 10 points
y: 110  // Move down 10 points
```

### Text Too Far Left/Right
```typescript
// If text is too far left, increase X value
// If text is too far right, decrease X value
x: 100  // Original
x: 110  // Move right 10 points
x: 90   // Move left 10 points
```

### Text Too Small/Large
```typescript
fontSize: 10  // Original
fontSize: 9   // Smaller
fontSize: 11  // Larger
```

### Long Text Overflow
```typescript
// Option 1: Reduce font size
fontSize: 9  // Instead of 10

// Option 2: Use multi-line text (split manually)
const lines = longText.match(/.{1,60}/g) || [longText];
lines.forEach((line, index) => {
  annotations.push({
    // ...
    y: baseY + (index * lineHeight),
    text: line,
  });
});

// Option 3: Truncate with ellipsis
text: longText.length > 100 ? longText.substring(0, 97) + '...' : longText
```

## Advanced: Dynamic Positioning

For more complex layouts, you can calculate positions dynamically:

```typescript
// Calculate tenant positions in a responsive grid
function getTenantPosition(index: number, totalTenants: number) {
  const columns = totalTenants <= 6 ? 2 : 3;
  const col = index % columns;
  const row = Math.floor(index / columns);
  
  const contentWidth = 504; // Available width after margins
  const columnWidth = contentWidth / columns;
  
  return {
    x: 54 + (col * columnWidth),  // 54 = left margin
    y: 200 + (row * 15),
  };
}

// Calculate page number based on content length
function calculatePage(baselineItems: number, currentIndex: number, itemsPerPage: number) {
  return Math.floor((baselineItems + currentIndex) / itemsPerPage);
}
```

## Sample Test Data

Use this for testing alignment:

```json
{
  "landlords": [
    {"legalName": "LANDLORD NAME ONE"},
    {"legalName": "LANDLORD NAME TWO WITH A VERY LONG NAME CORPORATION INC."}
  ],
  "tenants": [
    {"firstName": "TENANT", "lastName": "ONE"},
    {"firstName": "VERYLONGFIRSTNAME", "lastName": "VERYLONGLASTNAME"}
  ],
  "rentalUnit": {
    "unit": "UNIT 123",
    "streetNumber": "9999",
    "streetName": "VERY LONG STREET NAME BOULEVARD",
    "city": "CITY NAME",
    "province": "ON",
    "postalCode": "M5V 2N2"
  }
}
```

## Need Help?

If positions are significantly off:

1. **Verify template URL** - Make sure you're using the correct Form 2229E template
2. **Check PDF.co documentation** - https://docs.pdf.co/
3. **Export template field names** - Use PDF.co's `/pdf/info` endpoint to see existing fields
4. **Consider using template fields** - If your template has existing form fields, map to those instead

## Next Steps

1. Fill in the actual positions for your template
2. Update `buildPdfCoAnnotations()` in `index.ts` with these values
3. Test with sample data
4. Adjust as needed
5. Document your final configuration
