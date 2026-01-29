# Quick Position Adjustment Guide for Ontario Form 2229E

This guide helps you quickly adjust field positions to match your `2229e_standard-lease_static.pdf` template.

## 🎯 Quick Process

1. **Upload your template** → Get URL
2. **Generate test PDF** → See where fields appear
3. **Measure offsets** → Calculate position corrections
4. **Update coordinates** → In `index.ts`
5. **Redeploy & test** → Verify alignment

## 📋 Standard Ontario Form 2229E Field Locations

Based on the official Ontario Form 2229E, here are the typical field positions. **Adjust these to match YOUR specific template:**

### Page 1 (pages: "0")

```typescript
// SECTION 1: PARTIES
// Landlord(s) Legal Name(s)
x: 120, y: 145  // First landlord
x: 120, y: 165  // Second landlord (if applicable)
x: 120, y: 185  // Third landlord (if applicable)
x: 120, y: 205  // Fourth landlord (if applicable)

// Tenant(s) Name(s) - Grid layout (3 columns recommended)
// Tenant 1-3 (Row 1)
x: 120, y: 250  // Tenant 1
x: 280, y: 250  // Tenant 2
x: 440, y: 250  // Tenant 3

// Tenant 4-6 (Row 2)
x: 120, y: 270  // Tenant 4
x: 280, y: 270  // Tenant 5
x: 440, y: 270  // Tenant 6

// Continue pattern for tenants 7-12...

// SECTION 2: RENTAL UNIT
x: 120, y: 350  // Unit number
x: 180, y: 350  // Street number
x: 240, y: 350  // Street name
x: 120, y: 375  // City
x: 280, y: 375  // Province
x: 380, y: 375  // Postal Code
x: 120, y: 400  // Parking spaces description
x: 120, y: 425  // Condo checkbox ☑/☐

// SECTION 3: CONTACT INFORMATION
x: 120, y: 500  // Notice address
x: 120, y: 525  // Email consent checkbox
x: 180, y: 525  // Email address
x: 120, y: 550  // Emergency contact
```

### Page 2 (pages: "1")

```typescript
// SECTION 4: TERM
x: 120, y: 100  // Start date
x: 120, y: 125  // Fixed term checkbox
x: 250, y: 125  // Month-to-month checkbox
x: 120, y: 150  // End date (if fixed)

// SECTION 5: RENT
x: 120, y: 225  // Rent due day
x: 120, y: 250  // Base rent
x: 120, y: 275  // Parking rent
x: 120, y: 300  // Other services
x: 120, y: 325  // Total rent (bold/larger)
x: 120, y: 350  // Payable to
x: 120, y: 375  // Payment methods
x: 120, y: 400  // NSF fee
```

### Page 3 (pages: "2")

```typescript
// SECTION 6: SERVICES & UTILITIES
x: 120, y: 100  // Electricity responsibility
x: 120, y: 125  // Heat responsibility
x: 120, y: 150  // Water responsibility
x: 120, y: 200  // Gas checkbox
x: 120, y: 225  // Air conditioning checkbox
x: 120, y: 250  // Storage checkbox
x: 120, y: 275  // Laundry
x: 120, y: 300  // Guest parking
```

### Page 4 (pages: "3")

```typescript
// SECTION 7: RENT DISCOUNTS
x: 120, y: 100  // Discount description

// SECTION 8: RENT DEPOSIT
x: 120, y: 200  // Rent deposit amount

// SECTION 9: KEY DEPOSIT
x: 120, y: 300  // Key deposit amount
x: 120, y: 325  // Key deposit description
```

### Page 5 (pages: "4")

```typescript
// SECTION 10: SMOKING
x: 120, y: 100  // Smoking rules

// SECTION 11: INSURANCE
x: 120, y: 200  // Insurance required checkbox
```

### Page 6 (pages: "5")

```typescript
// SECTION 15: ADDITIONAL TERMS
x: 120, y: 100  // Additional terms text (may wrap)
```

### Page 7 (pages: "6") - SIGNATURE PAGE

```typescript
// LANDLORD SIGNATURES (4 maximum)
const landlordSignatures = {
  startY: 150,
  rowHeight: 80,
  signature: { x: 80, width: 220, height: 50 },
  date: { x: 320, width: 120, height: 35 }
};

// TENANT SIGNATURES (12 maximum, 2 columns)
const tenantSignatures = {
  startY: 450,
  rowHeight: 70,
  columns: 2,
  columnWidth: 280,
  signature: { x: 80, width: 180, height: 45 },
  date: { x: 270, width: 100, height: 30 }
};
```

## 🔧 How to Apply These Positions

### Step 1: Update in `index.ts`

Find the `buildPdfCoAnnotations()` function (starts around line 320) and update coordinates:

```typescript
// Example: Update landlord positions
formData.landlords.slice(0, 4).forEach((landlord, index) => {
  annotations.push({
    x: 120,  // ← Change this
    y: 145 + (index * 20),  // ← And this
    text: landlord.legalName,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "0"
  });
});
```

### Step 2: Update Signature Fields

Find the `buildSignatureFields()` function (starts around line 953) and update positions:

```typescript
// Landlord signatures
const landlordStartY = 150;  // ← Adjust this
const rowHeight = 80;         // ← And this

// Tenant signatures
const tenantStartY = 450;     // ← Adjust this
const rowHeight = 70;         // ← And this
```

## 🧪 Testing Workflow

```bash
# 1. Make changes to index.ts
# 2. Deploy
supabase functions deploy generate-lease-pdf

# 3. Generate test PDF
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/generate-lease-pdf" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "leaseId": "test-position-001",
    "formData": {
      "landlords": [{"legalName": "TEST LANDLORD"}],
      "tenants": [{"firstName": "TEST", "lastName": "TENANT"}],
      ...
    }
  }'

# 4. Download and review PDF
# 5. Measure any misalignment
# 6. Adjust coordinates by the offset
# 7. Repeat steps 2-6 until perfect
```

## 📐 Coordinate Calculation Examples

### Example 1: Text Too Far Right
```
Current position: x: 120
Text appears 30 points to the right of target
New position: x: 90  (120 - 30)
```

### Example 2: Text Too Low
```
Current position: y: 200
Text appears 15 points below target
New position: y: 185  (200 - 15)
```

### Example 3: Text Overlapping
```
Current spacing: y increment of 15
Text is overlapping vertically
New spacing: y increment of 20  (add more space)
```

## 🎨 Font Size Guidelines

Based on typical Ontario lease formatting:

```typescript
const FONT_SIZES = {
  sectionHeading: 11,    // Section titles
  normalText: 10,        // Most content
  smallText: 9,          // Secondary info
  checkboxes: 12,        // ☑ ☐ symbols
  totalRent: 12,         // Bold, emphasized
  signatures: 10         // Signature labels
};
```

## ⚡ Quick Fixes

### All text appears too far left
```typescript
// Add a global X offset
const BASE_X = 120;  // Increase this value
// Then use: x: BASE_X + offset
```

### All text appears too high
```typescript
// Add a global Y offset per page
const PAGE_OFFSETS = {
  0: 50,   // Page 1 offset
  1: 45,   // Page 2 offset
  // ...
};
```

### Tenant grid not fitting
```typescript
// Adjust column width and spacing
const col = index % 3;
const columnWidth = 170;  // Reduce if needed
x: 120 + (col * columnWidth)
```

### Signatures cut off
```typescript
// Increase signature area height
height: 60  // Increase from 50
```

## 📝 Position Tracking Template

Use this to track your adjustments:

```
SECTION 1 - PARTIES
[ ] Landlord 1 position: x: ___, y: ___
[ ] Landlord 2 position: x: ___, y: ___
[ ] Tenant 1 position: x: ___, y: ___
[ ] Tenant grid layout: ___ columns

SECTION 2 - RENTAL UNIT
[ ] Unit number: x: ___, y: ___
[ ] Street address: x: ___, y: ___
[ ] City/Province/Postal: x: ___, y: ___
[ ] Parking: x: ___, y: ___
[ ] Condo checkbox: x: ___, y: ___

[Continue for all sections...]

SIGNATURES
[ ] Landlord sig start Y: ___
[ ] Landlord row height: ___
[ ] Tenant sig start Y: ___
[ ] Tenant row height: ___
```

## 🚀 Ready to Customize

1. Upload your `2229e_standard-lease_static.pdf`
2. Use the positions above as starting points
3. Generate test PDF
4. Adjust based on your template's actual layout
5. Document your final positions in this file

---

**Note:** The positions above are typical for Ontario Form 2229E but may need adjustment for your specific template version.
