# TENANT DUPLICATE & VISIBILITY FIX - ACTION REQUIRED

## Issues Found

### 1. Tenants Showing Twice (Active + Inactive)
**Root Cause:** Multiple tenant records exist for the same user with different statuses
- Example: User has 2 tenant records - one "active", one "inactive"  
- BULK_FIX_ALL_TENANT_LINKS.sql created links for BOTH records
- Landlord now sees the same tenant twice in the list

### 2. Property Not Showing on Tenant Side
**Root Cause:** tenant_property_links query was using wrong ID
- `tenant_property_links.tenant_id` → stores `tenants.id` (tenant record ID)
- Tenant dashboard was querying by `user.id` (auth user ID)
- Fixed by looking up tenant record first: `tenants.user_id = user.id` → then query links

## Fixes Applied

### ✅ Code Fix: Tenant Dashboard Query
**File:** `app/(tabs)/tenant-dashboard.tsx`

**What Changed:**
```typescript
// BEFORE: Direct query (WRONG)
.eq('tenant_id', user.id)

// AFTER: Two-step lookup (CORRECT)
// 1. Find tenant record by user_id
const tenantRecords = await supabase
  .from('tenants')
  .select('id, first_name, last_name, status')
  .eq('user_id', user.id);

// 2. Use tenant record ID to find links
const activeTenant = tenantRecords?.find(t => t.status === 'active');
.eq('tenant_id', activeTenant.id)
```

This ensures the tenant dashboard properly finds property links even when multiple tenant records exist.

---

## Required Database Actions

### 🔴 ACTION 1: Run Diagnostic (Read-Only)
**File:** `docs/DIAGNOSE_TENANT_LINK_ISSUE.sql`

This shows:
- Which tenants have proper user_id linking
- Duplicate tenants by email
- Current tenant_property_links status

**Run this first to see the current state!**

---

### 🔴 ACTION 2: Clean Up Duplicates
**File:** `docs/CLEANUP_DUPLICATE_TENANTS.sql`

This will:
1. Show all duplicates (by user_id and email)
2. Keep only ONE tenant per user:
   - Prefers: `status = 'active'`
   - Falls back to: Most recently created
3. Delete tenant_property_links for duplicate tenants
4. Delete duplicate tenant records
5. Verify cleanup completed

**⚠️ IMPORTANT:** Review the "Tenants that will be DELETED" section before running!

---

## Step-by-Step Instructions

1. **Reload app** - The code fix is already applied, tenant dashboard will now work

2. **Check tenant side** - Open app as a tenant user:
   - Property should now show on dashboard
   - If not, check logs for tenant lookup

3. **Run diagnostic** - In Supabase SQL Editor:
   ```sql
   -- Copy and run: docs/DIAGNOSE_TENANT_LINK_ISSUE.sql
   ```
   - Check "Duplicate Tenants by Email" section
   - Note which tenants have duplicates

4. **Clean duplicates** - In Supabase SQL Editor:
   ```sql
   -- Copy and run: docs/CLEANUP_DUPLICATE_TENANTS.sql
   ```
   - Review which tenants will be kept/deleted
   - Verify it keeps the right ones (active status preferred)
   - Run the DELETE statements

5. **Verify in app**:
   - Landlord side: Each tenant should appear only ONCE
   - Tenant side: Property should be visible
   - No duplicate tenant issues

---

## What Actually Happened

### The BULK_FIX Script Issue
When you ran `BULK_FIX_ALL_TENANT_LINKS.sql`, it created links for **ALL** tenant records, including duplicates:

```sql
INSERT INTO tenant_property_links (tenant_id, property_id, ...)
SELECT 
    t.id as tenant_id,  -- Created link for EVERY tenant record
    ...
FROM tenants t
```

So if you had:
- John Smith (active) - ID: abc123
- John Smith (inactive) - ID: def456

It created links for BOTH, causing duplicates to appear in landlord's list.

### The Query Issue
The tenant dashboard was using:
```typescript
tenant_property_links.tenant_id = user.id  // user.id = auth user ID
```

But should have been:
```typescript
// 1. Find: tenants.user_id = user.id → gets tenant record
// 2. Query: tenant_property_links.tenant_id = tenant_record.id
```

---

## Expected Results After Fix

### Landlord View (Tenants Screen)
- ✅ Each tenant appears once
- ✅ Shows correct status (active/inactive)
- ✅ No duplicates

### Tenant View (Dashboard)
- ✅ Property card shows assigned property
- ✅ Address visible
- ✅ Unit name (if applicable)
- ✅ Can submit maintenance requests

---

## If Issues Persist

1. **Check logs:**
   ```
   Metro console → Look for:
   - 🔍 Step 1: Finding tenant record
   - ✅ Using tenant record: [id]
   - 🏠 Active tenant link data
   ```

2. **Verify user_id:**
   ```sql
   SELECT id, user_id, first_name, last_name, status 
   FROM tenants 
   WHERE email = '[tenant_email]';
   ```
   - Should have user_id filled in
   - If NULL, conversion didn't set it properly

3. **Check RLS policies:**
   - Tenants table: Allow tenants to read their own records
   - tenant_property_links: Allow tenants to read their links

---

## Summary

**Code Changes:** 1 file  
**Database Scripts:** 2 (diagnostic + cleanup)  
**Expected Time:** 5-10 minutes  
**Risk:** Low (cleanup script shows what will be deleted first)
