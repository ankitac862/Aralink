# Tenant-Landlord Relationship Fix

## Problem
The current tenant table structure stores the landlord's user_id in the `user_id` field, which breaks the intended design where `user_id` should be the tenant's auth user ID. This causes:
- Multiple tenants to have the same user_id (the landlord's ID)
- Conversations to get mixed up between different tenants
- Tenant record lookup to fail when attempting to find the correct user

## Solution
We need to properly separate the landlord and tenant relationships:

### STEP 1: Add landlord_id column to tenants table

```sql
-- Add landlord_id column to track who owns/manages the tenant
ALTER TABLE public.tenants
ADD COLUMN landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for landlord_id for faster queries
CREATE INDEX IF NOT EXISTS idx_tenants_landlord_id ON tenants(landlord_id);
```

### STEP 2: Update RLS policies

Replace the existing RLS policies with:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can insert own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can update own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can delete own tenants" ON tenants;

-- New policies for landlords to manage their tenants
CREATE POLICY "Landlords can view their tenants"
    ON tenants FOR SELECT
    USING (auth.uid() = landlord_id);

CREATE POLICY "Landlords can insert tenants"
    ON tenants FOR INSERT
    WITH CHECK (auth.uid() = landlord_id);

CREATE POLICY "Landlords can update their tenants"
    ON tenants FOR UPDATE
    USING (auth.uid() = landlord_id);

CREATE POLICY "Landlords can delete their tenants"
    ON tenants FOR DELETE
    USING (auth.uid() = landlord_id);

-- Tenants can view their own record
CREATE POLICY "Tenants can view their own profile"
    ON tenants FOR SELECT
    USING (auth.uid() = user_id);

-- Tenants can update their own record
CREATE POLICY "Tenants can update their own profile"
    ON tenants FOR UPDATE
    USING (auth.uid() = user_id);
```

### STEP 3: Migrate existing data

```sql
-- For existing tenants, if user_id is a landlord's ID, we need to clear it
-- and use landlord_id instead (since tenants haven't signed up yet)
UPDATE public.tenants
SET landlord_id = user_id, user_id = NULL
WHERE user_id IS NOT NULL AND created_at IS NOT NULL;
```

## Code Changes Required

### In tenantStore.ts `localToDbTenant`:
```typescript
const localToDbTenant = (tenant: Partial<Tenant>, landlordId: string): Partial<DbTenant> => ({
  landlord_id: landlordId,  // Store landlord's ID here
  user_id: tenant.userId || null,  // Store tenant's own user_id (null until they sign up)
  first_name: tenant.firstName || '',
  // ... rest of fields
});
```

### In messageService.ts `getOrCreateConversation`:
When a tenant hasn't signed up yet, we need to use email or tenant record ID for conversations, not user_id.
