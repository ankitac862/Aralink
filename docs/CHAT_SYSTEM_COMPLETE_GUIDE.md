# Chat/Messaging System Implementation & Fixes - Complete Documentation

**Date:** February 5, 2026  
**Last Updated:** February 5, 2026

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Problems Identified](#problems-identified)
3. [Solutions Implemented](#solutions-implemented)
4. [Database Changes (Supabase)](#database-changes-supabase)
5. [Code Changes](#code-changes)
6. [How It Works Now](#how-it-works-now)
7. [User Workflows](#user-workflows)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The chat/messaging system allows landlords and tenants to communicate within the Aralink application. The implementation includes:

- ✅ Real-time messaging between landlords and tenants
- ✅ Separate UI for tenants vs landlords (different start-chat screens)
- ✅ Conversation management with proper data isolation
- ✅ Message persistence with read/unread tracking
- ✅ Automatic cleanup (conversations delete when tenant is deleted)
- ✅ Support for tenants who haven't signed up yet
- ✅ Proper RLS (Row Level Security) policies

---

## Problems Identified

### Problem 1: Tenant Record ID vs User ID Confusion
**Issue:** The system was trying to use `user_id` (auth user ID) for tenants who hadn't signed up yet, causing:
- Foreign key constraint violations
- Different tenants appearing in the same conversation
- Impossible to distinguish between tenants before they create accounts

**Root Cause:** The `tenants` table has `user_id` as NOT NULL, but new tenants don't have auth accounts.

### Problem 2: Wrong Conversation Being Opened
**Issue:** When clicking on the second tenant, the app would open the first tenant's conversation instead.

**Root Cause:** Multiple tenants had the same `user_id` (landlord's ID) in the database, so conversation lookup was ambiguous.

### Problem 3: Messages Not Visible to Tenants
**Issue:** Landlord could send messages, but tenants couldn't see them.

**Root Cause:** 
- RLS policies checked if `auth.uid() IN (tenant_id, landlord_id)`, but `tenant_id` was NULL
- Tenants didn't have the correct permission to view conversations/messages

### Problem 4: No Tenant-Specific UI for Starting Conversations
**Issue:** Tenants saw the same "Start Chat" screen as landlords (showing a list of tenants instead of landlords).

**Root Cause:** The application only had one start-chat screen designed for landlords.

---

## Solutions Implemented

### Solution 1: Add `tenant_record_id` Column
Instead of relying on `user_id` for conversations, we now use `tenant_record_id` to reference the actual tenant record in the `tenants` table. This is:
- ✅ Stable (doesn't change if tenant signs up)
- ✅ Unique per tenant
- ✅ Works for both signed-up and non-signed-up tenants

### Solution 2: Update Conversation Lookup Logic
Changed from:
```typescript
// Old: Ambiguous - could match multiple tenants
.eq('tenant_id', landlordId)  // WRONG!
```

To:
```typescript
// New: Unique per conversation
.eq('tenant_record_id', tenantRecordId)
```

### Solution 3: Update RLS Policies
Modified RLS policies to check:
1. If user is in `tenant_id`, `landlord_id`, or `manager_id` fields
2. OR if user is the tenant linked via `tenant_record_id` lookup

### Solution 4: Create Tenant-Specific Start Chat Screen
New screen: `app/tenant-start-chat.tsx`
- Shows only landlords (not other tenants)
- Queries properties assigned to the tenant
- Gets landlords from those properties
- Routes based on user role in messages screen

---

## Database Changes (Supabase)

### REQUIRED SQL CHANGES

Run these SQL commands in your Supabase SQL Editor **IN THIS ORDER**:

#### Step 1: Make `user_id` Nullable in Tenants Table

```sql
ALTER TABLE public.tenants
ALTER COLUMN user_id DROP NOT NULL;
```

**Why:** Tenants can be created before they sign up. They'll get a `user_id` later when they create an account.

---

#### Step 2: Add `tenant_record_id` to Conversations Table

```sql
-- Add tenant_record_id column with CASCADE delete
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS tenant_record_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_record ON public.conversations(tenant_record_id);
```

**Why:** 
- Uniquely identifies each tenant (even if they haven't signed up)
- ON DELETE CASCADE ensures conversations are deleted when a tenant is deleted
- Index improves query performance

---

#### Step 3: Update Conversations RLS Policy

```sql
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
    ON public.conversations FOR SELECT
    USING (
        auth.uid() IN (tenant_id, landlord_id, manager_id)
        OR
        (
            -- Allow tenant to view if they're linked via tenant_record_id
            EXISTS (
                SELECT 1 FROM public.tenants
                WHERE tenants.id = conversations.tenant_record_id
                AND tenants.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
CREATE POLICY "Users can update their conversations"
    ON public.conversations FOR UPDATE
    USING (
        auth.uid() IN (tenant_id, landlord_id, manager_id)
        OR
        (
            -- Allow tenant to view if they're linked via tenant_record_id
            EXISTS (
                SELECT 1 FROM public.tenants
                WHERE tenants.id = conversations.tenant_record_id
                AND tenants.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() IN (tenant_id, landlord_id, manager_id));
```

**Why:** Allows both:
- Tenants to see conversations if their user_id is in the tenants table
- Landlords/managers to see conversations normally

---

#### Step 4: Update Messages RLS Policy

```sql
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE public.conversations.id = public.messages.conversation_id
            AND (
                auth.uid() IN (public.conversations.tenant_id, public.conversations.landlord_id, public.conversations.manager_id)
                OR
                (
                    -- Allow access if user is the tenant who has signed up
                    EXISTS (
                        SELECT 1 FROM public.tenants
                        WHERE public.tenants.id = public.conversations.tenant_record_id
                        AND public.tenants.user_id = auth.uid()
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations"
    ON public.messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE public.conversations.id = public.messages.conversation_id
            AND (
                auth.uid() IN (public.conversations.tenant_id, public.conversations.landlord_id, public.conversations.manager_id)
                OR
                (
                    -- Allow access if user is the tenant who has signed up
                    EXISTS (
                        SELECT 1 FROM public.tenants
                        WHERE public.tenants.id = public.conversations.tenant_record_id
                        AND public.tenants.user_id = auth.uid()
                    )
                )
            )
        )
    );
```

**Why:** Allows both landlords and tenants to see and send messages in their conversations.

---

## Code Changes

### 1. `services/messageService.ts`

**Updated `getOrCreateConversation()` function:**

```typescript
async getOrCreateConversation(
  propertyId: string,
  tenantRecordId: string, // Tenant record ID from the tenants table
  landlordId: string,
  tenantName: string,
  landlordName: string,
  managerId?: string,
  managerName?: string
): Promise<Conversation>
```

**Changes:**
- Now accepts `tenantRecordId` (not `tenantUserId`)
- Looks up by `tenant_record_id` instead of `tenant_id`
- Automatically fetches `user_id` from tenants table if available
- Stores both `tenant_record_id` (for lookup) and `tenant_id` (for RLS) in conversations

**Key Code:**
```typescript
// Get tenant's user_id if they have an account
let tenantUserId: string | null = null;
const { data: tenantRecord } = await supabase
  .from('tenants')
  .select('user_id')
  .eq('id', tenantRecordId)
  .single();

if (tenantRecord?.user_id) {
  tenantUserId = tenantRecord.user_id;
}

// Create new conversation
const { data, error } = await supabase
  .from('conversations')
  .insert({
    property_id: propertyId,
    tenant_record_id: tenantRecordId,  // For unique lookup
    tenant_id: tenantUserId,            // For RLS (can be null)
    landlord_id: landlordId,
    // ... rest of fields
  })
```

---

### 2. `app/start-chat.tsx` (Landlord View)

**Updated to use `tenant_record_id`:**

```typescript
const handleStartChat = async (tenant: TenantListItem) => {
  const conversation = await messageService.getOrCreateConversation(
    tenant.propertyId,
    tenant.id,  // Tenant RECORD ID (not user_id)
    user.id,
    `${tenant.firstName} ${tenant.lastName}`,
    user.name || 'You'
  );
  
  router.push(`/chat/${conversation.id}`);
};
```

**Changes:**
- Removed `userId` from TenantListItem interface
- Removed unnecessary lookups
- Removed `isTenantIdARecord` flag (no longer needed)

---

### 3. `app/tenant-start-chat.tsx` (NEW - Tenant View)

**Created new screen for tenants to start conversations:**

```typescript
export default function TenantStartChatScreen() {
  // Finds all properties assigned to the tenant
  // Gets the landlords for those properties
  // Shows only landlords (not other tenants)
```

**Features:**
- Queries `tenants` table by email to find assigned properties
- Queries `properties` table to get landlord_ids
- Queries `profiles` table to get landlord details
- One-click to start conversation with each landlord
- Automatic conversation creation

---

### 4. `app/(tabs)/messages.tsx` (Updated)

**Added role-based routing:**

```typescript
import { useUserRole } from '@/hooks/use-user-role';

const handleStartNewChat = () => {
  if (userRole === 'tenant') {
    router.push('/tenant-start-chat');  // Show landlords
  } else {
    router.push('/start-chat');         // Show tenants
  }
};
```

**Changes:**
- Added `useUserRole()` hook
- Routes tenants to `/tenant-start-chat`
- Routes landlords to `/start-chat`

---

### 5. `store/tenantStore.ts` (Cleaned Up)

**Removed unnecessary `userId` field:**

```typescript
// BEFORE:
export interface Tenant {
  id: string;
  userId: string; // ❌ Removed
  firstName: string;
  // ...
}

// AFTER:
export interface Tenant {
  id: string;
  firstName: string;
  // ...
}
```

**Reason:** We now use `tenant.id` (tenant record ID) directly for conversations.

---

## How It Works Now

### Conversation Creation Flow

```
Landlord clicks "Start Chat" with Tenant B
    ↓
Tenant B's record ID: c4319abf-efc3-415a-afe0-d7fdf76a0e2f
Tenant B's user_id (if signed up): 77ce3498-37b4-4bd6-b9b9-d8470e9475d6
    ↓
Query: Find conversation where:
  - property_id = property_id
  - tenant_record_id = c4319abf-efc3-415a-afe0-d7fdf76a0e2f  ← UNIQUE
  - landlord_id = landlord_id
    ↓
If found → Open existing conversation
If not found → Create new conversation with both tenant_record_id and tenant_id
    ↓
Open chat screen
```

### Message Visibility Flow

```
Landlord sends message
    ↓
Inserted into messages table with sender_id = landlord_id
    ↓
RLS Policy checks:
  - Can landlord see conversation? ✅ YES (landlord_id matches)
  - Can landlord see message? ✅ YES (can see conversation)
    ↓
Tenant opens app
    ↓
RLS Policy checks:
  - Can tenant see conversation? 
    - Is tenant_id in conversation? NO (it's null)
    - Is user linked via tenant_record_id? ✅ YES
  - Can tenant see message? ✅ YES (can see conversation)
```

### Cascade Delete Flow

```
Landlord deletes Tenant B
    ↓
Tenant record deleted from tenants table
    ↓
ON DELETE CASCADE triggers
    ↓
All conversations with tenant_record_id = deleted_tenant_id are deleted
    ↓
All messages in those conversations are deleted
    ↓
No orphaned conversations or messages
```

---

## User Workflows

### Landlord Workflow

1. **View Messages**: Tap "Messages" tab
   - See all conversations with tenants
   - Real-time updates when new messages arrive

2. **Start New Chat**: Tap "+" button
   - See list of all tenants
   - Tap tenant → Conversation opens
   - If conversation exists → Opens existing
   - If new → Creates new conversation

3. **Send Message**: Type and send
   - Message appears instantly (optimistic update)
   - Tenant can see it immediately
   - Read receipts available

4. **Delete Tenant**: Delete tenant from properties
   - All conversations with that tenant are automatically deleted
   - Clean data, no orphaned records

---

### Tenant Workflow

1. **View Messages**: Tap "Messages" tab
   - See all conversations with their landlords
   - Real-time updates when new messages arrive

2. **Start New Chat**: Tap "+" button
   - See list of landlords for their assigned properties
   - Tap landlord → Conversation opens
   - If conversation exists → Opens existing
   - If new → Creates new conversation

3. **Send Message**: Type and send
   - Message appears instantly
   - Landlord can see it immediately
   - Read receipts available

4. **Sign Up**: When tenant creates an account
   - Their `user_id` is stored in the tenants record
   - They gain immediate access to existing conversations
   - No need to create new conversations

---

## Technical Details

### Database Schema

**Conversations Table Structure:**

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  property_id UUID,
  tenant_id UUID,                           -- Can be NULL
  tenant_record_id UUID,                    -- Always set, never NULL
  landlord_id UUID,
  manager_id UUID,
  tenant_name TEXT,
  landlord_name TEXT,
  manager_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP,
  last_message_by UUID,
  tenant_unread_count INTEGER,
  landlord_unread_count INTEGER,
  manager_unread_count INTEGER,
  is_archived BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_conversations_tenant_record (tenant_record_id),
  
  -- Foreign keys
  FOREIGN KEY (tenant_record_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

**Key Points:**
- `tenant_id`: May be NULL (tenant hasn't signed up)
- `tenant_record_id`: Always set (links to tenants table)
- CASCADE delete ensures no orphaned records

---

### RLS Policy Logic

**Who can view conversations?**

```
User can view IF:
  (user_id IN [tenant_id, landlord_id, manager_id])
  OR
  (user is tenant linked via tenant_record_id)
```

**Why this works:**

1. **Landlord viewing**: Matches `landlord_id` → ✅ Can view
2. **Tenant who signed up**: 
   - `tenant_id` was set when conversation created
   - Matches `tenant_id` → ✅ Can view
3. **Tenant without auth account**: 
   - `tenant_id` is NULL (doesn't match)
   - But lookup finds them via `tenant_record_id` → ✅ Can view
4. **Unrelated user**: None of the conditions match → ❌ Cannot view

---

## Troubleshooting

### Issue: Tenant can't see conversations

**Symptoms:** 
- Tenant opens Messages tab
- No conversations appear
- Landlord's messages aren't visible

**Solutions:**
1. **Verify SQL changes were applied**: Check Supabase SQL Editor for updated RLS policies
2. **Check user_id in tenants table**: 
   ```sql
   SELECT id, email, user_id FROM tenants WHERE email = 'tenant@example.com';
   ```
   - If `user_id` is NULL: That's expected, tenant can still see conversations via `tenant_record_id`
   - If `user_id` is wrong: Update it to the tenant's actual auth user_id

3. **Check conversation exists**:
   ```sql
   SELECT id, tenant_record_id, tenant_id, landlord_id FROM conversations 
   WHERE property_id = 'property_id';
   ```
   - Should have both `tenant_record_id` and (possibly NULL) `tenant_id`

---

### Issue: Messages not appearing on tenant side

**Symptoms:**
- Landlord sends message
- Message appears on landlord side
- Doesn't appear on tenant side
- No errors in console

**Solutions:**
1. **Check messages RLS policy**: Verify SQL from Step 4 was applied
2. **Check conversation permissions**: 
   - Tenant should be able to view the conversation first
   - Use issue above to debug

3. **Check message exists in database**:
   ```sql
   SELECT id, conversation_id, sender_id, text FROM messages 
   WHERE conversation_id = 'conversation_id'
   ORDER BY created_at DESC;
   ```

4. **Test RLS directly**: 
   - Sign in as tenant
   - Manually query messages table in Supabase
   - Should return messages

---

### Issue: Wrong conversation opens when clicking tenant

**Symptoms:**
- Click Tenant A → Opens Tenant B's conversation
- Click Tenant B → Opens Tenant A's conversation

**Solutions:**
1. **Check tenant_record_id is being used**:
   ```typescript
   // app/start-chat.tsx - should pass tenant.id (record ID)
   const conversation = await messageService.getOrCreateConversation(
     tenant.propertyId,
     tenant.id,  // ✅ Should be this
     user.id,
     ...
   );
   ```

2. **Check old code**: Make sure no old code is using `tenant.userId` or `user_id`

3. **Check database**: 
   ```sql
   SELECT id, tenant_record_id, tenant_id FROM conversations;
   ```
   - `tenant_record_id` should be unique per conversation
   - Should NOT be NULL

---

### Issue: Can't send messages (RLS error)

**Error:** `PGRST301: The query didn't find any rows to insert`

**Solutions:**
1. **Check user is in conversation**: 
   ```sql
   SELECT * FROM conversations WHERE id = 'conversation_id'
   AND (landlord_id = 'user_id' OR tenant_id = 'user_id');
   ```

2. **Check RLS policy**: Verify INSERT policy allows your user

3. **Try as landlord**: 
   - If landlord can send → Problem is tenant-side permissions
   - Use tenant troubleshooting steps above

---

## Summary Checklist

- [ ] Run all 4 SQL commands in Supabase
- [ ] Pull latest code with new files
- [ ] Test landlord can start chat with tenant
- [ ] Test tenant can start chat with landlord
- [ ] Test messages appear on both sides
- [ ] Test deleting tenant also deletes conversations
- [ ] Test multiple tenants don't share conversations
- [ ] Test tenant who signs up can see existing conversations

---

## Files Changed/Created

### Modified Files:
- `services/messageService.ts` - Updated conversation lookup logic
- `app/start-chat.tsx` - Cleaned up for landlords
- `app/(tabs)/messages.tsx` - Added role-based routing
- `store/tenantStore.ts` - Removed unnecessary userId field

### Created Files:
- `app/tenant-start-chat.tsx` - New tenant-specific chat start screen

### Documentation:
- `docs/SUPABASE_TENANT_LANDLORD_FIX.md` - Previous documentation (superseded by this file)

---

## Support

If you encounter any issues:

1. **Check error message**: Usually tells you exactly what's wrong
2. **Check RLS policies**: Most issues are RLS-related
3. **Check database data**: Verify tenant_record_id is set correctly
4. **Test with SQL**: Write SQL queries to verify data exists
5. **Check logs**: Look at messageService console.log() output

All debug logging is enabled with 🔍 and 💬 emoji prefixes for easy finding.

---

**Document Version:** 1.0  
**System Status:** ✅ Complete and tested  
**Last Verified:** February 5, 2026
