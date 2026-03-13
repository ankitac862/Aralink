# TENANT NOT SHOWING ON LANDLORD SIDE - FIX GUIDE

## Issue
Tenants exist in database but don't appear in landlord's tenant list view.

## Root Causes
1. **Missing tenant_property_links** - Links between tenants and properties don't exist
2. **Property ID type mismatch** - UUID vs TEXT comparison failing in queries
3. **RLS policies** - Row Level Security blocking access

## Fixes Applied

### ✅ Code Fix: Property ID Type Conversion
**File:** `lib/supabase.ts` - fetchTenants()

**What Changed:**
```typescript
// BEFORE: Direct UUID comparison
.in('property_id', propertyIds)  // propertyIds = array of UUIDs

// AFTER: Convert to string for TEXT column comparison
const propertyIdsAsStrings = propertyIds.map(id => String(id));
.in('property_id', propertyIdsAsStrings)
```

This ensures queries work even if `tenant_property_links.property_id` is stored as TEXT while `properties.id` is UUID.

---

## Required Database Actions

### 🔴 STEP 1: Run Quick Check
**File:** `docs/QUICK_CHECK_LINKS.sql`

This will show:
- How many tenant_property_links exist  
- How many tenants have NO link  
- Property ID format issues

**Run this FIRST to see the current state!**

---

### 🔴 STEP 2: Create Missing Links (if needed)
**File:** `docs/BULK_FIX_ALL_TENANT_LINKS.sql`

If QUICK_CHECK shows tenants without links, run this script to:
1. Fix foreign key constraint
2. Create tenant_property_links for all tenants
3. Verify all tenants now have links

**Only run if tenants are missing links!**

---

### 🔴 STEP 3: Find Your Tenants
**File:** `docs/FIND_MY_TENANTS.sql`

Replace placeholders with your info:
- Line 6: Replace `'YOUR_EMAIL_HERE'` with your email
- Lines 16, 37, 51, 54: Replace `'PASTE_YOUR_USER_ID_HERE'` with your user ID from step 1

This shows exactly which tenants are linked to YOUR properties.

---

## Step-by-Step Instructions

### 1. Check App Logs
Open Metro console and look for:
```
🔍 Fetching tenants for landlord: [user_id]
📋 Found X properties for landlord
📋 Found X tenant links
✅ Fetched X tenants via links
```

If you see "0 tenant links" or "0 tenants", proceed to database checks.

### 2. Run Quick Check
In Supabase SQL Editor:
```sql
-- Copy entire contents of: docs/QUICK_CHECK_LINKS.sql
-- Paste and run
```

**Check Results:**
- Query 1: Should show count > 0 for tenant_property_links
- Query 3: Should be empty (no tenants without links)

### 3. Create Links (if missing)
If tenant_property_links count is 0 or tenants have no links:
```sql
-- Copy entire contents of: docs/BULK_FIX_ALL_TENANT_LINKS.sql
-- Paste and run
```

### 4. Verify in App
After running SQL fixes:
- Close and reopen the app
- Navigate to Tenants screen
- Tenants should now appear

### 5. If Still Not Showing
Run FIND_MY_TENANTS.sql (after replacing your email/user_id):
```sql
-- Results will show if tenants are linked to YOUR properties specifically
```

---

## Common Issues & Solutions

### Issue: "No tenant links found"
**Solution:** Run BULK_FIX_ALL_TENANT_LINKS.sql to create links

### Issue: "Property ID type mismatch"
**Solution:** Already fixed in code (property IDs converted to strings)

### Issue: "RLS Policy Error"
**Solution:** Check Supabase → Authentication → Policies:
- tenant_property_links: Allow landlord to read links for their properties
- tenants: Allow reading tenant records

### Issue: Tenants show for one landlord but not another
**Solution:** Each landlord only sees tenants linked to THEIR properties via tenant_property_links. Verify links exist for that specific landlord's properties using FIND_MY_TENANTS.sql

---

## Verification Checklist

After fixing, verify all of these:

- [ ] QUICK_CHECK_LINKS.sql shows tenant_property_links exist
- [ ] QUICK_CHECK_LINKS.sql shows no tenants without links
- [ ] App logs show: "Found X tenant links" (X > 0)
- [ ] App logs show: "Fetched X tenants via links" (X > 0)
- [ ] Tenants screen displays tenant list
- [ ] Each tenant shows correct property/unit info
- [ ] No duplicate tenants appear

---

## Technical Details

### How fetchTenants() Works
1. Get landlord's properties by user_id
2. Get tenant_property_links for those properties
3. Get tenant records by tenant IDs from links
4. Return unique tenant list

### Why Links Are Required
The system uses `tenant_property_links` as the authoritative source for tenant-property relationships because:
- Supports multiple properties per landlord
- Tracks active/inactive status
- Records when tenant was linked
- Supports tenant assignment to specific units

### Data Flow
```
Landlord (user_id)
  ↓
Properties (user_id = landlord)
  ↓
tenant_property_links (property_id)
  ↓
Tenants (id = tenant_id)
```

If ANY step breaks, tenants won't show.

---

## Files Reference

1. **QUICK_CHECK_LINKS.sql** - Fast diagnostic
2. **BULK_FIX_ALL_TENANT_LINKS.sql** - Create missing links
3. **FIND_MY_TENANTS.sql** - Personalized tenant search
4. **DEBUG_TENANT_NOT_SHOWING.sql** - Detailed debugging
5. **CLEANUP_DUPLICATE_TENANTS.sql** - Remove duplicates

---

## Expected Results

**Before Fix:**
- Tenants exist in database
- No tenant_property_links OR type mismatch in query
- Landlord sees empty tenant list

**After Fix:**
- tenant_property_links exist for all tenants
- Query properly matches property IDs (UUID → string conversion)
- Landlord sees all tenants linked to their properties
- No duplicates
- Correct property/unit info displayed

---

**Status:** ✅ CODE FIXED (property ID conversion)  
**Action Required:** Run QUICK_CHECK_LINKS.sql, then BULK_FIX if needed  
**Expected Time:** 5 minutes
