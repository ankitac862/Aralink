# Solution: 12 Tenants on 4-Row Template

## Problem
- **PDF template** has only 4 labeled tenant rows
- **App sends** up to 12 tenants
- **Need:** Fit all 12 tenants in the PDF

## Solution Implemented ✅

### Strategy: Extend Beyond Labeled Rows

The PDF template has 4 labeled rows, but we can continue adding text below them with the same format.

### Page 1 - Tenant Names (Section 1)

**Labeled Rows (1-4):**
```
Row 1: Last Name [____] First Name [____]  ← PDF template labels
Row 2: Last Name [____] First Name [____]  ← PDF template labels  
Row 3: Last Name [____] First Name [____]  ← PDF template labels
Row 4: Last Name [____] First Name [____]  ← PDF template labels
```

**Extended Rows (5-12):**
```
Row 5: [____]          [____]              ← We add these (same format)
Row 6: [____]          [____]              ← No labels, but same spacing
Row 7: [____]          [____]
Row 8: [____]          [____]
Row 9: [____]          [____]
Row 10: [____]         [____]
Row 11: [____]         [____]
Row 12: [____]         [____]
```

### Implementation Details

#### Tenant Names on Page 1
```typescript
// All 12 tenants rendered in 2 columns
formData.tenants.slice(0, 12).forEach((tenant, index) => {
  const yPos = 445 + (index * 27);  // Continuous spacing
  
  // Last Name (left column at x:150)
  // First Name (right column at x:410)
  // Font size: 9pt (slightly smaller to fit more)
});
```

**Layout:**
```
Y Position  | Tenant | Has Label?
------------|--------|------------
445         | 1      | Yes (template)
472         | 2      | Yes (template)
499         | 3      | Yes (template)
526         | 4      | Yes (template)
553         | 5      | No (we add)
580         | 6      | No (we add)
607         | 7      | No (we add)
634         | 8      | No (we add)
661         | 9      | No (we add)
688         | 10     | No (we add)
715         | 11     | No (we add)
742         | 12     | No (we add)
```

#### Signature Page (Page 7)
```typescript
// 2 columns × 6 rows = 12 tenant signatures
formData.tenants.slice(0, 12).forEach((tenant, index) => {
  const col = index % 2;              // Column 0 or 1
  const row = Math.floor(index / 2);  // Row 0-5
  const yPos = 400 + (row * 60);      // 60 points spacing
  
  // Smaller fields to fit 12:
  // - Font size: 8pt
  // - Signature height: 35pt
  // - Row spacing: 60pt
});
```

**Layout:**
```
Column 1              Column 2
--------------------- ---------------------
Tenant 1: [sig][date] Tenant 2: [sig][date]
Tenant 3: [sig][date] Tenant 4: [sig][date]
Tenant 5: [sig][date] Tenant 6: [sig][date]
Tenant 7: [sig][date] Tenant 8: [sig][date]
Tenant 9: [sig][date] Tenant 10: [sig][date]
Tenant 11: [sig][date] Tenant 12: [sig][date]
```

---

## Key Changes Made

### 1. Interface (Line 115)
```typescript
// Up to 12 tenants (app sends 12, but PDF template has 4 rows)
tenants: Tenant[];
```

### 2. Page 1 Rendering (Lines ~345-370)
```typescript
// Changed from .slice(0, 4) to .slice(0, 12)
formData.tenants.slice(0, 12).forEach((tenant, index) => {
  const yPos = 445 + (index * 27);  // Continuous spacing for 12
  // Font size: 9pt (slightly smaller)
});
```

### 3. Signature Fields (Lines ~1030-1070)
```typescript
// Changed from .slice(0, 4) to .slice(0, 12)
formData.tenants.slice(0, 12).forEach((tenant, index) => {
  const col = index % 2;              // 2 columns
  const row = Math.floor(index / 2);  // 6 rows
  const yPos = 400 + (row * 60);      // Tighter spacing
  // Font size: 8pt (smaller to fit)
});
```

---

## Visual Representation

### Page 1 (Names)
```
┌─────────────────────────────────────────────┐
│ 1. Parties to the Agreement                │
│                                             │
│ Landlord(s)                                 │
│   Landlord's Legal Name: [Jane Smith]      │ ← Labeled
│                                             │
│ and Tenant(s)                               │
│   Last Name: [Anderson]  First Name: [Alice]  │ ← Row 1 (labeled)
│   Last Name: [Brown]     First Name: [Bob]    │ ← Row 2 (labeled)
│   Last Name: [Clark]     First Name: [Carol]  │ ← Row 3 (labeled)
│   Last Name: [Davis]     First Name: [David]  │ ← Row 4 (labeled)
│   [Evans]                [Edward]             │ ← Row 5 (no label)
│   [Foster]               [Fiona]              │ ← Row 6 (no label)
│   [Garcia]               [George]             │ ← Row 7 (no label)
│   [Harris]               [Hannah]             │ ← Row 8 (no label)
│   [Ivanov]               [Ian]                │ ← Row 9 (no label)
│   [Jackson]              [Julia]              │ ← Row 10 (no label)
│   [Kim]                  [Kevin]              │ ← Row 11 (no label)
│   [Lopez]                [Laura]              │ ← Row 12 (no label)
│                                             │
│ 2. Rental Unit                              │
└─────────────────────────────────────────────┘
```

### Page 7 (Signatures)
```
┌─────────────────────────────────────────────┐
│ 17. Signatures                              │
│                                             │
│ Landlord Signatures                         │
│   Landlord 1: Jane Smith                    │
│   [Signature]_____________ Date: [____]     │
│                                             │
│ Tenant Signatures                           │
│                                             │
│ Tenant 1: Alice Anderson  Tenant 2: Bob Brown     │
│ [Sig]_____ Date:[___]    [Sig]_____ Date:[___]   │
│                                             │
│ Tenant 3: Carol Clark    Tenant 4: David Davis    │
│ [Sig]_____ Date:[___]    [Sig]_____ Date:[___]   │
│                                             │
│ Tenant 5: Edward Evans   Tenant 6: Fiona Foster  │
│ [Sig]_____ Date:[___]    [Sig]_____ Date:[___]   │
│                                             │
│ Tenant 7: George Garcia  Tenant 8: Hannah Harris │
│ [Sig]_____ Date:[___]    [Sig]_____ Date:[___]   │
│                                             │
│ Tenant 9: Ian Ivanov     Tenant 10: Julia Jackson│
│ [Sig]_____ Date:[___]    [Sig]_____ Date:[___]   │
│                                             │
│ Tenant 11: Kevin Kim     Tenant 12: Laura Lopez  │
│ [Sig]_____ Date:[___]    [Sig]_____ Date:[___]   │
└─────────────────────────────────────────────┘
```

---

## Space Considerations

### Will 12 Tenants Fit?

**Page 1 (Names):**
- Start Y: 445
- Spacing: 27 points
- End Y: 445 + (11 × 27) = 742
- Page height: 792 points
- **Space remaining: 50 points** ✅ Fits!

**Page 7 (Signatures):**
- Start Y: 400
- Rows: 6 (for 12 tenants in 2 columns)
- Spacing: 60 points per row
- End Y: 400 + (5 × 60) = 700
- Page height: 792 points
- **Space remaining: 92 points** ✅ Fits!

---

## Font Size Adjustments

To fit 12 tenants clearly:

| Element | Size | Reason |
|---------|------|--------|
| **Tenant names (Page 1)** | 9pt | Slightly smaller for density |
| **Signature labels (Page 7)** | 8pt | Smaller to fit 12 rows |
| **Landlord names** | 10pt | Normal size (only 4) |
| **Other text** | 10pt | Standard size |

---

## Testing

### Test with Maximum (12 Tenants + 4 Landlords)
```json
{
  "landlords": [
    {"legalName": "Jane Smith"},
    {"legalName": "John Doe"},
    {"legalName": "Mary Johnson"},
    {"legalName": "Bob Williams"}
  ],
  "tenants": [
    {"firstName": "Alice", "lastName": "Anderson"},
    {"firstName": "Bob", "lastName": "Brown"},
    {"firstName": "Carol", "lastName": "Clark"},
    {"firstName": "David", "lastName": "Davis"},
    {"firstName": "Edward", "lastName": "Evans"},
    {"firstName": "Fiona", "lastName": "Foster"},
    {"firstName": "George", "lastName": "Garcia"},
    {"firstName": "Hannah", "lastName": "Harris"},
    {"firstName": "Ian", "lastName": "Ivanov"},
    {"firstName": "Julia", "lastName": "Jackson"},
    {"firstName": "Kevin", "lastName": "Kim"},
    {"firstName": "Laura", "lastName": "Lopez"}
  ]
}
```

---

## Advantages of This Approach

✅ **Flexible:** Handles 1-12 tenants seamlessly
✅ **Clean:** Uses consistent spacing and format
✅ **Compliant:** First 4 rows have labels as per template
✅ **Readable:** Font sizes adjusted for clarity
✅ **Professional:** Maintains clean layout

---

## Status

✅ **COMPLETE - Supports 12 tenants**
- Page 1: All 12 names rendered
- Page 7: All 12 signature fields
- Uses actual PDF template positions
- Maintains professional appearance

**Ready to deploy and test!**
