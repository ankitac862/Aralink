# New Tenant Onboarding & Lifecycle Flow - Complete Implementation

**Date:** March 16, 2026  
**Version:** 2.0  
**Status:** ✅ IMPLEMENTED

---

## Quick Overview

The Aaralink platform has been redesigned to follow a **two-tier public signup model with invitation-based tenant activation** and **hard-delete tenant lifecycle**:

### Old Flow (Deprecated)
- Three public signup options: Landlord, Property Manager, **Tenant**
- Tenant self-signs up directly
- On lease signing, applicant → tenant conversion

### New Flow (Active)
- **Two public signup options only**: Landlord, Property Manager
- Tenants are **invited by email** with an activation link
- Tenants set their password via activation screen
- On tenant activation + lease signing: applicant → tenant conversion
- On lease end/removal: **complete hard-delete** of tenant account + auth user + all data

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PUBLIC SIGNUP FLOW                             │
│                                                                       │
│  Landlord/Manager Sign Up                                            │
│  ↓                                                                    │
│  Create Account (Email/Phone) → Email or OTP Verification            │
│  ↓                                                                    │
│  Dashboard Access                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│               TENANT INVITATION-BASED FLOW                           │
│                                                                       │
│  Lease Created (Applicant submitted)                                 │
│  ↓                                                                    │
│  Landlord Approves Application                                       │
│  ↓                                                                    │
│  Landlord Signs Lease                                                │
│  ↓                                                                    │
│  Tenant Invitation Email Sent (with activation link & token)         │
│  ↓                                                                    │
│  Tenant Clicks Link → activate-tenant screen                         │
│  ↓                                                                    │
│  Tenant Sets Password & Creates Account                              │
│  ↓                                                                    │
│  Auth User Created + Tenant Profile Created                          │
│  ↓                                                                    │
│  Applicant → Tenant Conversion via Edge Function                     │
│  ↓                                                                    │
│  Tenant Can Now Login & Access Dashboard                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                TENANT HARD-DELETE LIFECYCLE                          │
│                                                                       │
│  Lease Ends / Landlord Removes Tenant                                │
│  ↓                                                                    │
│  Initiate Tenant Removal (initiateTenantRemoval())                   │
│  ↓                                                                    │
│  Hard-Delete Edge Function Called with Service Role                  │
│  ↓                                                                    │
│  Auth User Completely Deleted                                        │
│  Tenant Profile Deleted                                              │
│  Tenant Records Deleted                                              │
│  Co-Tenant Records Deleted                                           │
│  Tenant Property Links Deleted                                       │
│  Optional: Messages Soft-Deleted (marked deletion date)              │
│  Optional: Lease Soft-Deleted or Hard-Deleted                        │
│  ↓                                                                    │
│  Tenant No Longer Exists in System                                   │
│  All Personal Data Purged                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Client-Side Changes

### 1.1 Signup Screen Modifications ([register.tsx](../../app/(auth)/register.tsx))

**Changes:**
- Removed `UserTypeCard` for Tenant role
- Landlord and Property Manager cards still available
- Added informational box explaining tenant signup process
- Tenant invitation link added with clear messaging

**Code:**
```tsx
{/* Tenant Signup Info */}
<View style={[styles.tenantInfoBox, { backgroundColor: isDark ? '#1e293b' : '#EFF6FF' }]}>
  <MaterialCommunityIcons name="information" size={20} color={primaryColor} />
  <View style={{ flex: 1, marginLeft: 12 }}>
    <ThemedText style={[styles.tenantInfoTitle, { color: textColor }]}>
      Tenant Signup
    </ThemedText>
    <ThemedText style={[styles.tenantInfoText, { color: subtextColor }]}>
      Tenants are invited by their landlord via email with an activation link and temporary password.
    </ThemedText>
  </View>
</View>
```

### 1.2 Auth Store Validation ([authStore.ts](../../store/authStore.ts))

**Changes:**
- Added early validation in `signUp()` to reject tenant role
- Error message directs users to wait for landlord invitation

**Code:**
```typescript
if (role === 'tenant') {
  const errorMessage = 'Tenant accounts can only be created via invitation. Contact your landlord for access.';
  set({ isLoading: false, error: errorMessage });
  return { success: false, error: errorMessage };
}
```

### 1.3 New Tenant Activation Screen ([activate-tenant.tsx](../../app/(auth)/activate-tenant.tsx))

**Purpose:** Handle tenant account creation when they click the invitation link

**Features:**
- Validates invitation token and email
- Shows tenant name (pre-filled from invitation)
- Displays email (view-only, from invitation)
- Password setup with show/hide toggle
- Error handling for expired/invalid invitations
- Auto-forwards to login on activation

**Flow:**
1. User clicks link: `activate-tenant?token=xxx&email=yyy@example.com`
2. Screen validates token against `tenant_invitations` table
3. User enters name and password
4. System creates auth account + profile
5. Marks invitation as activated
6. Converts applicant → tenant in background
7. Redirects to login screen

---

## 2. Database Changes

### 2.1 New Table: `tenant_invitations`

**Purpose:** Track all tenant invitations with secure tokens

**Schema:**
```sql
create table tenant_invitations (
  id uuid primary key,
  token text unique not null,           -- Secure random token
  email text not null,                   -- Tenant email
  tenant_name text,                      -- Pre-filled name
  application_id uuid references applications(id),
  lease_id uuid references leases(id),
  user_id uuid references auth.users(id), -- Set after activation
  property_id uuid references properties(id),
  created_by_user_id uuid references auth.users(id), -- Landlord who invited
  status text check (status in ('pending', 'activated', 'expired')),
  created_at timestamp default now(),
  activated_at timestamp,                -- Set after user activates
  expires_at timestamp default (now() + interval '30 days')
);
```

**Usage:**
- Created when landlord signs lease (not at lease creation)
- Token + email checked during activation
- Updated to 'activated' when user creates account
- Can be soft-deleted after 30 days (optional cleanup)

---

## 3. Backend Functions

### 3.1 Invitation Creation & Sending

**Function:** `createTenantInvitation()`
- **Location:** [lib/supabase.ts](../lib/supabase.ts#L4200)
- **Purpose:** Create invitation record + generate secure token
- **Input:**
  - email, tenantName, applicationId, leaseId, propertyId
- **Output:** invitation record + activation link

```typescript
const result = await createTenantInvitation({
  email: 'tenant@example.com',
  tenantName: 'John Doe',
  applicationId: 'app-123',
  leaseId: 'lease-456',
  propertyId: 'prop-789',
});
// Returns: { success: true, invitation, activationLink: 'https://app.com/activate-tenant?token=xyz...' }
```

**Function:** `sendTenantInvitationEmail()`
- **Location:** [lib/supabase.ts](../lib/supabase.ts#L4230)
- **Purpose:** Send email via Resend with activation link
- **Calls:** Edge Function `send-tenant-invitation`
- **Email:** HTML template with clear CTA button

### 3.2 Lease Signing → Invitation Flow

**Function:** `handleInviteBasedLeaseSigning()`
- **Location:** [lib/supabase.ts](../lib/supabase.ts#L4250)
- **Purpose:** Orchestrate invitation when lease is signed
- **Called From:** [landlord-applications.tsx](../../app/landlord-applications.tsx#L220)
- **Previous Function:** `convertApplicantToTenant()` (still exists for direct conversion)

**New Flow in Landlord Applications:**
```typescript
// OLD (deprecated):
// const result = await convertApplicantToTenant({ applicationId, ...});

// NEW (invitation-based):
const result = await handleInviteBasedLeaseSigning({
  applicationId: application.id,
  leaseId: lease.id,
  propertyId: application.property_id,
  applicantEmail: application.applicant_email,
  applicantName: application.applicant_name,
  propertyName: property.address,
  landlordName: landlordProfile.name,
});
```

**Steps:**
1. Create invitation record
2. Send email via Edge Function
3. Update lease status to 'sent' (awaiting tenant activation)
4. Return success message

### 3.3 Tenant Activation Completion

**Function:** `completeTenantActivation()`
- **Location:** [lib/supabase.ts](../lib/supabase.ts#L4311)
- **Purpose:** Complete activation after tenant sets password
- **Called From:** activate-tenant screen after successful signup

**Steps:**
1. Verify invitation exists
2. Mark invitation as activated with user_id
3. Call convertApplicantToTenant() to create tenant record
4. Return success with tenant details

---

## 4. Tenant Deletion Pipeline

### 4.1 Hard Delete Functions

**Function:** `hardDeleteTenant()`
- **Location:** [lib/supabase.ts](../lib/supabase.ts#L4397)
- **Purpose:** Orchestrate full tenant account deletion
- **Input:** tenantId, optional leaseId, optional reason
- **Process:**
  1. Get tenant details + user_id
  2. Call hard-delete edge function
  3. Edge function deletes auth user (requires service role key)
  4. Delete all tenant-related records:
     - Co-tenant records
     - Tenant property links
     - Profile record
     - Optionally: messages (soft-delete), leases (soft or hard)
  5. Return deletion report

```typescript
const result = await hardDeleteTenant({
  tenantId: 'tenant-123',
  leaseId: 'lease-456',
  reason: 'Lease ended',
});
// Returns: {success: true, message: '...', deletedRecords: {...}}
```

**Function:** `initiateTenantRemoval()`
- **Location:** [lib/supabase.ts](../lib/supabase.ts#L4467)
- **Purpose:** Trigger deletion when lease ends or manual removal
- **Input:** leaseId, reason ('lease_ended' | 'manual_removal' | 'payment_failed')
- **Process:**
  1. Get lease + tenant_id
  2. Call hardDeleteTenant() with tenant_id
  3. Mark lease as terminated

```typescript
// When lease ends or landlord removes tenant:
const result = await initiateTenantRemoval({
  leaseId: 'lease-456',
  reason: 'lease_ended',
});
```

### 4.2 Edge Function: `hard-delete-tenant-account`

**Location:** [supabase/functions/hard-delete-tenant-account/index.ts](../../supabase/functions/hard-delete-tenant-account/index.ts)

**Purpose:** Server-side deletion with service role key access

**Why Edge Function?**
- Needs `SUPABASE_SERVICE_ROLE_KEY` to delete from `auth.users` table
- Cannot be done client-side (RLS policies block direct auth.users deletion)
- Requires special permissions that should never be exposed to client

**Operations:**
1. Delete auth user record (irreversible)
2. Delete profile record
3. Delete co-tenant records
4. Delete tenant property links
5. Soft-delete or hard-delete messages
6. Soft-delete or hard-delete lease
7. Delete tenant record

**Request:**
```typescript
{
  userId: 'auth-user-uuid',
  tenantId: 'tenant-record-uuid',
  leaseId: 'lease-uuid',
  reason: 'Account deleted',
  retainLeaseHistory: true // If true, soft-delete; if false, hard-delete
}
```

**Response:**
```typescript
{
  success: true,
  message: 'Tenant account and associated data permanently deleted',
  deletedRecords: {
    authUser: true,
    profile: true,
    tenant: true,
    tenantPropertyLinks: 1,
    coTenants: 0,
    leases: 1,
    messages: 0
  }
}
```

---

## 5. Edge Functions

### 5.1 `send-tenant-invitation`

**File:** [supabase/functions/send-tenant-invitation/index.ts](../../supabase/functions/send-tenant-invitation/index.ts)

**Purpose:** Send HTML email to tenant with activation link

**Configuration Required:**
```env
# .env.local or Supabase environment variables
RESEND_API_KEY=re_xxxxxxxxxxxxxxx
FROM_EMAIL=noreply@aaralink.com
```

**Email Template:**
- Personalized greeting with tenant name
- Property information (address, unit)
- Activation button (clickable link)
- Fallback link (copy-paste)
- Instructions on what tenant can do after signup
- Expiration warning (30 days)

**Invoked From:** `sendTenantInvitationEmail()` in lib/supabase.ts

### 5.2 `hard-delete-tenant-account`

**File:** [supabase/functions/hard-delete-tenant-account/index.ts](../../supabase/functions/hard-delete-tenant-account/index.ts)

**Authorization:**
- Requires Bearer token in Authorization header
- Validates Supabase token (optional additional layer)
- Service role key used internally for auth deletion

**Operations:** See Section 4.2

---

## 6. Implementation Checklist

### Prerequisites
- [x] Supabase project with auth enabled
- [x] Postgres database with tables
- [x] Edge Functions Deno runtime

### Database Setup
- [ ] Run migration: [TENANT_INVITATIONS_MIGRATION.sql](../TENANT_INVITATIONS_MIGRATION.sql)
  ```bash
  # In Supabase Dashboard SQL Editor:
  # Paste contents of TENANT_INVITATIONS_MIGRATION.sql
  # Execute
  ```

### Environment Variables
- [ ] Set `RESEND_API_KEY` in Supabase environment
  - Go to Supabase Dashboard → Settings → Edge Functions → Environment Variables
  - Add: `RESEND_API_KEY=re_xxxxx`
- [ ] Set `FROM_EMAIL` (optional, defaults to `noreply@aaralink.com`)

### Edge Functions Deployment
- [ ] Deploy `send-tenant-invitation` function
  ```bash
  supabase functions deploy send-tenant-invitation
  ```
- [ ] Deploy `hard-delete-tenant-account` function
  ```bash
  supabase functions deploy hard-delete-tenant-account
  ```

### Code Changes
- [x] Register.tsx: Hide tenant signup, show info box
- [x] AuthStore.ts: Add tenant rejection logic
- [x] Create activate-tenant.tsx: New activation screen
- [x] Add invitation functions to supabase.ts
- [x] Add deletion functions to supabase.ts
- [x] Update landlord-applications.tsx to use invite flow
- [x] Type checking: All files compile without errors

### Testing
- [ ] Test signup: Landlord/Manager signup works correctly
- [ ] Test signup rejection: Cannot signup as tenant
- [ ] Test invitation email: Email sent when lease signed
- [ ] Test activation link: Clicking link opens activate-tenant screen
- [ ] Test password setup: User creates account via activation
- [ ] Test tenant access: Newly activated tenant can login
- [ ] Test deletion: Tenant deletion removes all data
- [ ] Test auth user deletion: User cannot login after deletion

---

## 7. Testing Guide

### Test 1: Landlord Signs Up
1. Go to registration screen
2. Select "Landlord"
3. Enter email, password, name
4. Complete email/phone verification
5. ✅ Should see dashboard

### Test 2: Tenant Cannot Self-Signup
1. Go to registration screen
2. Note: "Tenant" card NOT visible
3. See informational box: "Tenants are invited..."
4. ✅ Only Landlord and Property Manager options

### Test 3: Lease Signing Sends Invitation
1. Landlord creates application for property
2. Landlord approves application
3. Landlord signs lease (creates lease document)
4. Landlord clicks "Convert to Tenant" (now says "Send Invitation")
5. ✅ Email with activation link sent to applicant

### Test 4: Tenant Activates Account
1. Tenant receives email
2. Clicks activation button
3. Go to activation screen
4. Enter name and password
5. Click "Activate Account"
6. ✅ Redirected to login
7. Login with email + password
8. ✅ Access dashboard

### Test 5: Tenant Account Deleted
1. Landlord goes to tenant management
2. Removes tenant (or lease ends)
3. ✅ Tenant's auth account deleted
4. ✅ Cannot login anymore
5. ✅ Profile, records, etc. all removed

---

## 8. Database Status Tracking

### Lease Status Values
- `draft`: Initial creation
- `sent`: Invitation sent to tenant (awaiting activation)
- `accepted_by_tenant`: Tenant has activated (optional)
- `signed`: Signed by all parties (includes applicant→tenant conversion)
- `active`: Currently active
- `terminated`: Lease ended, tenant deleted

### Tenant Invitation Status
- `pending`: Invitation created, not yet claimed
- `activated`: Tenant created account via activation link
- `expired`: 30+ days old (eligible for cleanup)

---

## 9. Security Considerations

### Token Security
- Tokens are random 64-character strings
- Tokens are unique per invitation
- Tokens verified against email (both must match)
- Tokens expire after 30 days
- One-time use (marked activated after claim)

### Auth User Deletion
- Requires `SUPABASE_SERVICE_ROLE_KEY`
- Only used in Edge Function (never exposed client-side)
- All associated data deleted in single transaction
- Cannot be undone (is permanent hard delete)

### Email Verification
- Invitation email not changed after creation
- Activation link includes email in URL (visible in browser)
- No sensitive data in email body (only activation link)

### RLS Policies
- `tenant_invitations` table has custom RLS
- Users see only their own invitations
- Landlords see invitations they created
- Service role bypasses RLS for edge function operations

---

## 10. Troubleshooting

### Issue: "Phone signups are disabled" error
**Cause:** Supabase SMS provider not configured  
**Solution:** Configure SMS provider (Twilio/MessageBird) in Supabase Dashboard or use email-only

### Issue: Invitation email not received
**Cause 1:** RESEND_API_KEY not set  
**Solution:** Add environment variable to Supabase  
**Cause 2:** Email marked as spam  
**Solution:** Use from_email that matches domain (corporate email preferred)

### Issue: Activation link not working
**Cause:** Token expired (> 30 days)  
**Solution:** Landlord must resend invitation

### Issue: "Tenant cannot be deleted because..."
**Cause:** Edge function not deployed or service role key missing  
**Solution:** Deploy edge function, verify environment variable set

### Issue: Hard delete didn't remove certain records
**Cause:** RLS policies preventing deletion  
**Solution:** Edge function bypasses RLS, check logs for details

---

## 11. API Reference

### Quick Reference Table

| Function | Purpose | Parameters | Returns |
|----------|---------|-----------|---------|
| `createTenantInvitation` | Create invitation | email, tenantName, applicationId, leaseId, propertyId | {success, invitation, activationLink} |
| `sendTenantInvitationEmail` | Send email | email, tenantName, activationLink, propertyName, landlordName | {success, data} |
| `handleInviteBasedLeaseSigning` | Full invitation flow | applicationId, leaseId, propertyId, ... | {success, message} |
| `completeTenantActivation` | Finish activation after signup | invitationToken, userId | {success, tenant, message} |
| `hardDeleteTenant` | Delete all tenant data | tenantId, leaseId, reason | {success, message, deletedRecords} |
| `initiateTenantRemoval` | Trigger deletion | leaseId, reason | {success, message, deletedRecords} |

---

## 12. Migration from Old System

### If You Have Existing Tenants

Run this to preserve active tenants (do NOT delete):
```sql
-- Existing tenants stay in 'tenants' table
-- Do NOT convert them; they already have accounts
-- Only NEW tenants use invitation system
```

### If You're Starting Fresh
- Simply deploy this new flow
- All new tenants follow invitation process
- No migration needed

---

## 13. Future Enhancements

- [ ] Resend invitation email if not claimed (new option in landlord UI)
- [ ] Tenant account suspension (before hard delete)
- [ ] Audit log of all deletions
- [ ] Soft delete with 30-day recovery window
- [ ] Bulk tenant invitations (invite multiple at once)
- [ ] Custom onboarding email templates
- [ ] Integration with lease PDF (activation link embedded in PDF)
- [ ] SMS invitations (when SMS provider enabled)

---

**Implementation Completed:** March 16, 2026  
**Created By:** Aaralink Development  
**Last Updated:** March 16, 2026
