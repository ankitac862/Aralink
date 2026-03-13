# FIXES NEEDED - READ THIS

## Issue 1: "Lease not found" when sending lease to applicant
**Root Cause:** The send-lease edge function was trying to join with the `tenants` table, but applicant leases have `tenant_id = NULL` and `application_id` set instead.

**Fix Applied:** Updated `/supabase/functions/send-lease/index.ts` to:
1. Fetch tenant OR applicant info separately (not via join)
2. Handle both cases properly
3. Get email from applicant if no tenant exists

**To Deploy:**
```bash
cd Aralink
supabase login
supabase functions deploy send-lease
```

OR manually copy the updated `send-lease/index.ts` file to your Supabase dashboard:
1. Go to Supabase Dashboard → Edge Functions
2. Edit `send-lease` function
3. Copy code from `/Aralink/supabase/functions/send-lease/index.ts`
4. Deploy

---

## Issue 2: Tenants not showing in list
**Root Cause:** ALL tenants missing `tenant_property_links` records due to wrong FK constraint.

**Status:** ✅ Cleaned orphaned links with CLEAN_ORPHANED_LINKS_FIRST.sql

**Next Step:** Run BULK_FIX_ALL_TENANT_LINKS.sql to create missing links
```sql
-- Run this in Supabase SQL Editor
-- File: /Aralink/docs/BULK_FIX_ALL_TENANT_LINKS.sql
```

---

## Testing Order:
1. ✅ Run BULK_FIX_ALL_TENANT_LINKS.sql (creates tenant_property_links for all 11 tenants)
2. ✅ Verify tenants appear in Tenants tab
3. Deploy send-lease function fix
4. Test sending lease to an applicant:
   - Approve applicant
   - Fill lease form
   - Send lease → Should work now!
   - Applicant signs
   - Convert to tenant → Should appear in list

---

## What Was Fixed:

### send-lease/index.ts (Lines 302-370)
**Before:**
```typescript
// Joined with tenants table - FAILS for applicants
.select(`
  *,
  tenants:tenant_id (id, name, email)
`)
```

**After:**
```typescript
// Fetch lease first, then fetch tenant OR applicant separately
.select(`
  *,
  properties:property_id (...)
`)

// Then separately fetch based on what exists:
if (lease.tenant_id) {
  // Fetch from tenants table
} else if (lease.application_id) {
  // Fetch from applications table
}
```

This allows sending leases to applicants (who don't have tenant_id yet) as well as existing tenants.
