# Aaralink — Complete App Understanding

> **Document Purpose:** A living technical reference covering what the app does, how every part works, known edge cases, and security vulnerabilities. Keep this updated as the app evolves.

---

## Table of Contents

1. [What the App Is](#1-what-the-app-is)
2. [Tech Stack](#2-tech-stack)
3. [User Roles](#3-user-roles)
4. [Project Structure](#4-project-structure)
5. [Authentication & Onboarding](#5-authentication--onboarding)
6. [Invite & Tenant Onboarding Flow](#6-invite--tenant-onboarding-flow)
7. [Landlord Features](#7-landlord-features)
8. [Tenant Features](#8-tenant-features)
9. [AraPartner Feature](#9-arapartner-feature)
10. [Database Schema (Key Tables)](#10-database-schema-key-tables)
11. [Edge Functions (Backend Logic)](#11-edge-functions-backend-logic)
12. [State Management (Stores)](#12-state-management-stores)
13. [Storage Buckets](#13-storage-buckets)
14. [Real-Time & Push Notifications](#14-real-time--push-notifications)
15. [Lease Lifecycle (Full Detail)](#15-lease-lifecycle-full-detail)
16. [Maintenance Lifecycle](#16-maintenance-lifecycle)
17. [Accounting & Transactions](#17-accounting--transactions)
18. [Marketplace](#18-marketplace)
19. [Edge Cases](#19-edge-cases)
20. [Security Vulnerabilities](#20-security-vulnerabilities)
21. [Known Pre-existing Code Issues](#21-known-pre-existing-code-issues)

---

## 1. What the App Is

**Aaralink** is a Canadian property management platform targeting Ontario landlords and tenants. It digitises the full rental lifecycle:

- A **landlord** lists properties, invites tenants, issues Ontario Standard Leases, tracks rent, logs maintenance, and chats with tenants.
- A **tenant** receives an email invite, sets a password, signs the lease, submits maintenance requests, views rent history, and messages their landlord.
- An **AraPartner** (referral agent) submits landlord leads and earns a monthly commission on approved referrals.

The app runs on **iOS, Android, and Web** from a single Expo codebase.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo (React Native) with Expo Router (file-based navigation) |
| Language | TypeScript |
| State | Zustand (one store per domain) |
| Backend / DB | Supabase (Postgres + GoTrue Auth + Realtime + Storage + Edge Functions) |
| Edge Functions | Deno runtime on Supabase |
| PDF Generation | Custom edge function (`generate-lease-pdf`) that fills Ontario Standard Lease template |
| Push Notifications | Expo Push Notification service + `push_tokens` table |
| Real-time Chat | Supabase Realtime (Postgres changes on `messages` and `conversations` tables) |
| Navigation | Expo Router v2 — Stack + Tabs |
| Styling | React Native StyleSheet (inline dynamic theme, no external UI lib) |
| Theme | Manual dark/light via `useColorScheme` |

---

## 3. User Roles

| Role | Where Set | What They Can Do |
|---|---|---|
| `landlord` | On signup / Google OAuth role select | Manage properties, tenants, leases, accounting, maintenance |
| `tenant` | On signup or auto-assigned on invite accept | View home, apply for lease, submit maintenance, chat |
| `manager` | Same as landlord (DB supports it; UI shares landlord screens) | Same as landlord |
| `ara_partner` | On signup / Google OAuth role select | Referral section only — submit landlord leads, view payouts |
| `admin` | DB schema only (`profiles.user_type` constraint includes it) | **No dedicated UI screens exist yet** — admin sees landlord dashboard |

**Role enforcement layers:**
1. `_layout.tsx` auth guard — redirects based on `user.role` on every navigation change
2. `(tabs)/_layout.tsx` — hides/shows tabs based on role (`isLandlordOrManager` boolean)
3. Supabase RLS policies — server-side enforcement per table
4. Edge function ownership checks — e.g., `property.user_id !== authData.user.id → 403`

---

## 4. Project Structure

```
Aralink/
├── app/                          # All screens (Expo Router)
│   ├── _layout.tsx               # Root layout — auth guard, OAuth redirect handler
│   ├── (auth)/                   # Public screens (no session required)
│   │   ├── index.tsx             # Auth landing (login or register selector)
│   │   ├── login.tsx             # Email/phone + password login
│   │   ├── register.tsx          # Sign up (email/phone, name, role selection)
│   │   ├── otp.tsx               # OTP verification screen
│   │   ├── verify-email.tsx      # Post-signup email verification prompt
│   │   ├── forgot-password.tsx   # Password reset request
│   │   ├── social-role-select.tsx # Role selection after Google OAuth
│   │   └── activate-tenant.tsx   # Tenant account activation via magic link
│   ├── (tabs)/                   # Bottom-tab screens (session required)
│   │   ├── landlord-dashboard.tsx # Landlord home — stats, charts, tiles, activity
│   │   ├── tenant-dashboard.tsx   # Tenant home — property, rent, maintenance, chat
│   │   ├── messages.tsx           # Conversation list
│   │   ├── alerts.tsx             # Notification list
│   │   └── settings.tsx           # App settings
│   ├── ara-partner/              # AraPartner section
│   │   ├── dashboard.tsx         # Referral stats
│   │   ├── referrals.tsx         # Referral list
│   │   ├── submit-referral.tsx   # New referral form
│   │   ├── payouts.tsx           # Payout history
│   │   └── profile.tsx           # AraPartner profile + payment details
│   ├── invite.tsx                # Invite landing (reads token, prompts login/signup)
│   ├── invite-auth.tsx           # Auth callback handler (sets password, accepts invite)
│   ├── set-password.tsx          # Password reset flow
│   ├── properties.tsx            # Property list (All / Active / Inactive tabs)
│   ├── property-detail.tsx       # Property detail — photos, units, rooms, lease mgmt
│   ├── add-property.tsx          # Add / edit property modal
│   ├── add-unit.tsx              # Add unit to a property
│   ├── add-room.tsx              # Add room (sub-unit)
│   ├── tenants.tsx               # Tenant list
│   ├── tenant-detail.tsx         # Tenant detail — payment history, co-tenants
│   ├── add-tenant.tsx            # Manual tenant add (not via invite)
│   ├── applicants.tsx            # Applicant list (landlord side)
│   ├── applicant-detail.tsx      # Application review
│   ├── add-applicant.tsx         # Invite applicant form
│   ├── landlord-applications.tsx # All pending applications
│   ├── landlord-application-review.tsx # Approve/reject application
│   ├── leases.tsx                # Lease list (landlord)
│   ├── lease-detail.tsx          # Lease view/edit (landlord)
│   ├── lease-wizard/             # Ontario Standard Lease creation wizard
│   │   ├── step1.tsx – step6b.tsx # Property → Rent → Services → Rules → Signatures
│   ├── finalize-lease-terms.tsx  # Set move-in date and final terms
│   ├── lease-preview.tsx         # PDF preview before sending
│   ├── lease-sent.tsx            # Confirmation after sending
│   ├── tenant-lease-start.tsx    # Tenant application start
│   ├── tenant-lease-step1.tsx – step6.tsx # Personal info → Employment → References
│   ├── tenant-lease-submitted.tsx # Application submitted confirmation
│   ├── tenant-lease-status.tsx   # Track application status
│   ├── tenant-lease-review-sign.tsx # Tenant signs the lease
│   ├── tenant-leases.tsx         # Tenant's lease list
│   ├── tenant-lease-detail.tsx   # Tenant lease detail view
│   ├── accounting.tsx            # Income/expense tracker (landlord)
│   ├── add-transaction.tsx       # Record income or expense
│   ├── transaction-detail.tsx    # Transaction detail
│   ├── invoice-detail.tsx        # Invoice view
│   ├── maintenance.tsx           # Maintenance list (legacy)
│   ├── landlord-maintenance-overview.tsx # Landlord maintenance dashboard
│   ├── landlord-maintenance-detail.tsx   # Manage a request
│   ├── tenant-maintenance-request.tsx    # Tenant submits request
│   ├── tenant-maintenance-confirmation.tsx
│   ├── tenant-maintenance-status.tsx     # Status of tenant's requests
│   ├── tenant-maintenance-detail.tsx     # Tenant sees request detail
│   ├── marketplace.tsx           # Vendor discovery
│   ├── vendor-select.tsx         # Select vendor for maintenance request
│   ├── chat/[id].tsx             # Chat screen (real-time messages)
│   ├── start-chat.tsx / tenant-start-chat.tsx # Initiate conversation
│   ├── notifications.tsx         # Full notification list
│   ├── profile.tsx               # User profile edit
│   └── debug-properties.tsx      # Developer debug screen (should not ship)
│
├── store/                        # Zustand state stores
│   ├── authStore.ts              # Session, user, role, OAuth
│   ├── propertyStore.ts          # Properties, units, sub-units
│   ├── tenantStore.ts            # Tenants
│   ├── leaseStore.ts             # Lease records
│   ├── ontarioLeaseStore.ts      # Ontario Standard Lease wizard form data (961 lines)
│   ├── maintenanceStore.ts       # Maintenance requests
│   └── araPartnerStore.ts        # AraPartner referrals, payouts
│
├── lib/
│   └── supabase.ts               # All Supabase client calls (~5,200 lines)
│
├── services/
│   ├── messageService.ts         # Chat conversations and messages
│   └── vendorService.ts          # Vendor list fetch
│
├── supabase/
│   ├── functions/                # Deno edge functions
│   └── migrations/               # Postgres migration SQL files
│
├── hooks/
│   └── usePushNotifications.ts   # Expo push token registration + deep link handler
│
└── utils/
    ├── activityIcon.ts           # Maps notification type → icon
    └── excelExport.ts            # Export transactions to Excel
```

---

## 5. Authentication & Onboarding

### Sign Up (Email/Phone)
1. User enters email or phone, password, name, and selects role (landlord/tenant/ara_partner).
2. `authStore.signUp()` calls `supabase.auth.signUp()` with `user_metadata: { role, user_type, full_name }`.
3. If email: verification email sent → user lands on `verify-email.tsx`.
4. If phone: OTP sent → user lands on `otp.tsx`.
5. After verification, `upsertUserProfile()` creates or updates the `profiles` row.

### Sign In (Email/Phone)
1. `authStore.signIn()` accepts email or phone (normalised to E.164 for phone).
2. Calls `supabase.auth.signInWithPassword()`.
3. Profile fetched; role resolved from `profiles.user_type` → `user_metadata.role` → `user_metadata.user_type` → cached `userRole` in AsyncStorage (in that priority order).
4. `userRole` is written to AsyncStorage/localStorage after every successful sign-in.

### Google OAuth
1. `authStore.signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
2. On mobile, uses `expo-auth-session` with `WebBrowser.openAuthSessionAsync`.
3. After redirect, session is detected in `_layout.tsx` (via `queryParams.has('code')`).
4. If the Google account is **new**: `pendingOAuthSession` is set in Zustand; user is forced to `social-role-select.tsx` to choose landlord/tenant/ara_partner.
5. `completeSocialSignIn(role)` writes the role to user metadata and creates the profile row.
6. If the Google account **already exists**: skips role selection, goes directly to the appropriate dashboard.

### Session Persistence
- Supabase JS SDK persists the JWT and refresh token via `AsyncStorage` (native) or `localStorage` (web).
- On app start, `initialize()` reads the local session, validates it with Supabase, then refreshes if needed.
- `onAuthStateChange` listener handles token refreshes and sign-out events app-wide.

### Password Reset
1. `authStore.resetPassword(email)` calls `supabase.auth.resetPasswordForEmail()`.
2. Supabase sends an email; the link contains a recovery token in the URL hash.
3. `_layout.tsx` detects `hashParams.get('type') === 'recovery'` and routes to `/invite-auth`.
4. `invite-auth.tsx` exchanges the token for a session and redirects to `set-password.tsx`.

---

## 6. Invite & Tenant Onboarding Flow

This is the most complex flow in the app. Understanding it end-to-end is critical.

### Step 1 — Landlord Sends Invite

**For an existing/new tenant:**
- Landlord opens `add-tenant.tsx`, enters email, picks property/unit/room.
- Calls `invite-tenant` edge function via `lib/supabase.ts → inviteTenantToProperty()`.

**For an applicant (someone who has applied or been pre-screened):**
- Landlord opens `add-applicant.tsx`, enters email, picks property.
- Calls `invite-applicant` edge function.

### Step 2 — `invite-tenant` / `invite-applicant` Edge Function

Both functions share the same pattern:

```
1. Verify caller JWT → supabase.auth.getUser(jwt)
2. Verify landlord owns the property → property.user_id === caller.id  (→ 403 if not)
3. Expire any existing pending invites for the same email + property
4. Generate raw token → crypto.randomUUID()
5. Hash token → SHA-256(rawToken + INVITE_TOKEN_PEPPER)
6. Store hashed token in `invites` table (expires_at = now + 7 days)
7. Create/update user in auth.users (if new) via supabase.auth.admin.inviteUserByEmail()
8. supabase.auth.admin.inviteUserByEmail() sends the GoTrue invitation email
   with redirect_to = https://aaralink.ca/invite-auth
9. Create notification for the tenant
10. Return { success: true }
```

### Step 3 — Email Delivery

- GoTrue sends an email containing a link like:
  `https://aaralink.ca/#access_token=...&type=invite`
- The `redirect_to` in the function call ensures the URL base is `aaralink.ca/invite-auth`.
- **Client-side safety net:** `_layout.tsx` (lines 45–72) detects `type=invite`, `access_token`, or `refresh_token` in the URL hash on **any** path and calls `router.replace('/invite-auth' + hash)`. This handles the case where GoTrue strips the path from `redirect_to`.

### Step 4 — Tenant Opens Link

- Browser opens `https://aaralink.ca/invite-auth#access_token=...&type=invite`.
- `invite-auth.tsx` extracts the access token from the hash.
- Exchanges for a full Supabase session via `supabase.auth.setSession()`.
- If `type=invite` and user `has_set_password = false`: redirects to password-setting form.
- After password is set, user is authenticated with a real session.

### Step 5 — Accepting the Invite

- Tenant is shown the invite details (property address, landlord name) via `get-invite` edge function.
- Tenant taps "Accept" → `accept-invite` edge function called with raw token.
  ```
  1. Hash token → SHA-256(token + pepper)
  2. Look up invite by token_hash
  3. Check invite.status === 'pending'  (→ 409 if not)
  4. Check expires_at > now  (→ 410 if expired)
  5. Check invite.tenant_email === authenticated user's email  (→ 403 if mismatch)
  6. Upsert tenant_property_links (tenant_id, property_id, unit_id, sub_unit_id, status='active')
  7. Update invite.status = 'accepted'
  ```
- Or tenant taps "Decline" → `decline-invite` edge function updates `invite.status = 'declined'`.

### Step 6 — Post-Invite State

- `tenant_property_links` record links tenant to property/unit/room.
- Tenant dashboard (`propertyInfo` state) picks up the link and shows "YOUR HOME".
- Landlord's tenant list now shows the tenant as active.

### Edge Case: User Not Logged In When Clicking Invite Link

- `invite.tsx` detects the token in URL params.
- If no session: stores token in `AsyncStorage` under key `pendingInviteToken`.
- After login/signup, `_layout.tsx` checks `pendingInviteToken` and redirects to `/invite?token=...`.

---

## 7. Landlord Features

### Property Management
- **Types:** `single_unit` (one rented unit, may have rooms), `multi_unit` (multiple apartments), `commercial`, `parking`.
- **CRUD:** Add, edit, deactivate/reactivate via `properties.tsx` and `add-property.tsx`.
- **Deactivation:** Sets `properties.status = 'inactive'`. Does NOT cascade to leases or tenant links — tenant dashboard still shows the home.
- **Quick links on each card:** Tenant Detail, Units (multi_unit), Rooms (single_unit with rooms).

### Unit & Room Management
- Units added via `add-unit.tsx` → stored in `units` table.
- Sub-units (rooms) added via `add-room.tsx` → stored in `sub_units` table.
- Each unit/room can have a `tenantId` and `isOccupied` flag.

### Tenant Management
- View all tenants: `tenants.tsx`.
- Tenant detail: `tenant-detail.tsx` — shows payment history, co-tenants, linked property.
- Remove tenant: calls `hard-delete-tenant-account` edge function.
- Add tenant manually (without invite): `add-tenant.tsx`.

### Lease Management
- Full lifecycle from draft to active (see Section 15).
- Ontario Standard Lease wizard: 6 steps covering property details, rent, services, rules, additional terms, and signatures.
- Can upload a custom PDF instead of generating.
- After sending, tenant receives email with PDF link.

### Accounting
- Record income (rent, deposits) and expenses (repairs, utilities, insurance).
- View by property filter, date range.
- Dashboard charts: Rent Collection pie chart, Income vs Expense bar chart.
- Excel export of transactions via `utils/excelExport.ts`.

### Maintenance
- View all requests on `landlord-maintenance-overview.tsx`.
- Filter by status (new, in_progress, resolved, etc.) and urgency.
- Detail view: update status, assign vendor, add notes, link expense transaction.
- Landlord can also create requests themselves (`landlord-maintenance-create.tsx`).

### Messaging
- One `conversations` row per (property, tenant, landlord) triplet.
- Real-time via Supabase Realtime channel subscription.
- Push notification sent via `send-message-notification` edge function on new message.

### Applicant Pipeline
- `landlord-applications.tsx`: list of pending applications (tenants who submitted the 6-step form).
- `landlord-application-review.tsx`: view full application, approve or reject.
- Approval triggers lease creation workflow.

---

## 8. Tenant Features

### Tenant Dashboard
Key state variables that drive the dashboard:
- `propertyInfo` — set from `tenant_property_links` + `properties` join. If null → tenant is "applicant only" (has no assigned home).
- `pendingInvites` — open invites not yet accepted.
- `pendingLeases` — leases in `sent`, `generated`, or `pending_signature` status.
- `isApplicantOnly = !propertyInfo`.
- `showStartApplicationButton` — hidden if the one pending invite is for the same address/unit/room the tenant already occupies.

### Lease Application (Tenant Side)
6-step wizard collected via `ontarioLeaseStore`:
1. **Step 1:** Personal details (name, DOB, ID type, ID number, current address).
2. **Step 2:** Co-applicant info (optional).
3. **Step 3:** Employment (employer, income, length of employment).
4. **Step 4:** References (2 personal references).
5. **Step 5:** Rental history (previous landlord, reason for leaving).
6. **Step 6:** Consent, additional notes, signature.

Submitted application creates an `applicants` record. Tenant can track status via `tenant-lease-status.tsx`.

### Signing a Lease
- Landlord generates and sends lease (PDF stored in `lease-documents` bucket).
- Tenant sees "Lease Signature Required" card on dashboard.
- `tenant-lease-review-sign.tsx` shows the PDF and collects signature.
- After signing, `notify-landlord-lease-countersign` edge function notifies landlord.

### Maintenance
- `tenant-maintenance-request.tsx`: select category (plumbing, electrical, HVAC, appliance, general), urgency, availability, permission to enter, attach photos.
- Attachments stored in private `maintenance-attachments` bucket (5 MB limit, image/video only).
- Tenant tracks status on `tenant-maintenance-status.tsx`.
- After resolution, tenant can leave feedback and a 1–5 rating.

### "Start Application" Button Visibility Logic
Hidden when: `pendingInvites.length === 1` AND the single invite's `propertyId + unitId + subUnitId` exactly matches the tenant's current `propertyInfo.propertyId + unitId + subUnitId`. Prevents a tenant from re-applying for the home they already live in.

---

## 9. AraPartner Feature

A separate section of the app (`ara-partner/`) for referral agents who bring landlords onto the platform.

### Flow
1. AraPartner signs up with role `ara_partner`.
2. Submits referral: landlord name, phone, email, property address (unique constraint prevents duplicates).
3. Admin reviews and sets status to `approved` + sets `subscription_fee`.
4. Admin creates `commission_rules` record with `commission_percent` and date range.
5. Monthly cron (`generate-monthly-payouts`) runs on the last day of each month:
   - Finds all approved referrals with `subscription_fee`.
   - Looks up the active commission rule (where `start_date <= today <= end_date OR end_date IS NULL`).
   - Calculates `amount = subscription_fee × (commission_percent / 100)`.
   - Inserts `payout_records` row (UNIQUE on `referral_id + payout_month` prevents duplicates).
6. AraPartner views payouts in `payouts.tsx`.

### Payment Methods
Stored in `ara_partners` table: `etransfer` (email for e-transfer) or `bank` (transit + routing + account). Snapshotted at payout time.

---

## 10. Database Schema (Key Tables)

```sql
profiles              -- All users. user_type: landlord|tenant|manager|ara_partner|admin
properties            -- Landlord's properties. user_id = landlord
units                 -- Belong to properties. tenantId, isOccupied
sub_units             -- Rooms. Belong to units. tenantId
tenant_property_links -- Tenant ↔ Property assignment. status: active|inactive
invites               -- Invite tokens (SHA-256 hashed). status: pending|accepted|expired|declined
applicants            -- Lease applicants. landlord_id, property_id, status
leases                -- Leases. user_id=landlord, tenant_id, document_url. 
                         status: draft|uploaded|signed|signed_pending_move_in|active|terminated|rejected
transactions          -- Income/expense ledger. type: income|expense. category: rent|maintenance|utility|etc.
maintenance_requests  -- Full lifecycle. status: new|under_review|in_progress|waiting_vendor|resolved|cancelled
conversations         -- One per (property, tenant, landlord) triplet
messages              -- Chat messages. conversation_id FK
push_tokens           -- Expo push tokens per user per device
notifications         -- In-app notifications. is_read flag
ara_partners          -- Extended profile for AraPartner users
referrals             -- Landlord referrals. UNIQUE(property_address)
commission_rules      -- Per referral, supports rate history
payout_records        -- Monthly payouts. UNIQUE(referral_id, payout_month)
audit_log             -- Admin change tracking
```

### RLS Policy Summary
- **`properties`**: Owner selects/inserts/updates their own (`user_id = auth.uid()`).
- **`tenants` / `tenant_property_links`**: Landlord sees tenants linked to their properties; tenant sees own record.
- **`leases`**: Landlord sees leases for their properties; tenant sees leases where `tenant_id = auth.uid()`.
- **`maintenance_requests`**: Two separate SELECT policies — tenant sees their own, landlord sees all for their properties. UPDATE allowed for both (field-level validation enforced in service layer).
- **`messages` / `conversations`**: Supabase RLS (exact policy depends on migrations not in the repo).

---

## 11. Edge Functions (Backend Logic)

All edge functions use the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS where needed (user creation, cross-table writes). Caller identity is verified via `supabase.auth.getUser(jwt)` from the `Authorization` header.

| Function | Trigger | Auth Check | What It Does |
|---|---|---|---|
| `invite-tenant` | Landlord sends invite | JWT + property ownership | Creates auth user, hashes token, stores invite, sends GoTrue email |
| `invite-applicant` | Landlord invites applicant | JWT + property ownership | Same as above but for applicant type |
| `get-invite` | Token in URL → load invite details | JWT (any authenticated user) | Returns invite metadata for display |
| `accept-invite` | Tenant accepts invite | JWT + email match | Updates `tenant_property_links`, marks invite accepted |
| `decline-invite` | Tenant declines | JWT + email match | Marks invite declined |
| `complete-applicant-invite-password` | Applicant sets password | JWT | Updates `has_set_password`, sets user_type |
| `send-lease` | Landlord sends lease | JWT + lease ownership (`lease.user_id === caller.id`) | Emails lease PDF link to tenant, updates lease status |
| `generate-lease-pdf` | Landlord generates PDF | JWT + lease ownership | Fills Ontario Standard Lease template, stores in `lease-documents` bucket |
| `hard-delete-tenant-account` | Landlord removes tenant | Bearer token present (NOT verified!) | Deletes auth user + profile + links + leases + messages |
| `send-push-notification` | Internal (called by other functions) | None (internal use) | Sends Expo push notification |
| `send-message-notification` | New chat message | Service role | Looks up recipient push token, sends notification |
| `notify-landlord-lease-countersign` | Tenant signs lease | JWT | Notifies landlord of tenant signature |
| `generate-monthly-payouts` | Cron (last day of month) | **None — no auth check** | Creates `payout_records` for all approved referrals |
| `resolve-tenant` | (Purpose unclear) | Unknown | Appears to be a utility function for resolving tenant linkages |
| `resolve-tenant copy` | Duplicate directory | N/A | **Should be deleted — never deployed** |

### Token Security Model
```
raw_token = crypto.randomUUID()                       // sent to user via email
token_hash = SHA-256(raw_token + INVITE_TOKEN_PEPPER) // stored in DB
```
Only the hash is ever stored; the raw token only ever exists in the email link and briefly in memory. SHA-256 prevents rainbow-table attacks if the DB is breached. The pepper adds an extra secret layer — meaningless if `INVITE_TOKEN_PEPPER` is not set in env.

---

## 12. State Management (Stores)

| Store | Key State | Loaded When |
|---|---|---|
| `authStore` | `user`, `session`, `isInitialized`, `pendingOAuthSession` | On app start (`initialize()`), on every `onAuthStateChange` event |
| `propertyStore` | `properties[]` (with nested `units[]` and `subUnits[]`) | On landlord dashboard focus, on properties screen mount |
| `tenantStore` | `tenants[]` | On tenants screen mount |
| `leaseStore` | `leases[]` | On leases screen mount |
| `ontarioLeaseStore` | `formData` (Ontario lease wizard, 17 sections) | Populated step-by-step through lease wizard |
| `maintenanceStore` | `requests[]` | On maintenance screens |
| `araPartnerStore` | `referrals[]`, `payouts[]`, `partner` | On AraPartner screen focus |

**Important:** Stores are populated lazily. If you navigate directly to a detail screen without going through the list screen first, the store may be empty. Several features rely on the store being pre-loaded (e.g., `getTenantsByProperty()` in the properties screen quick-link).

---

## 13. Storage Buckets

| Bucket | Public? | File Limit | Allowed Types | Used For |
|---|---|---|---|---|
| `property-images` | Yes | No limit set in code | No server-side MIME restriction | Property photos, unit photos |
| `tenant-photos` | Yes | No limit set in code | No server-side MIME restriction | Tenant profile photos |
| `lease-documents` | No (signed URLs) | Not set | PDFs | Generated and uploaded lease PDFs |
| `maintenance-attachments` | No (signed URLs) | 5 MB | image/jpeg, image/png, image/webp, image/heic, video/mp4, video/quicktime | Maintenance request photos/videos |

### Upload Flow (`lib/supabase.ts → uploadImage()`)
1. On **native**: reads file as base64 via `expo-file-system`, converts to ArrayBuffer, uploads as binary.
2. On **web**: fetches the blob URL, uploads the blob.
3. **Content-type is derived from file extension in the URI string**, not actual file bytes.

---

## 14. Real-Time & Push Notifications

### Real-Time Chat
- `messageService.subscribeToMessages(conversationId, callback)` opens a Supabase Realtime channel: `messages:${conversationId}`.
- `messageService.subscribeToConversations(callback)` listens on all `conversations` changes.
- Duplicate prevention: new messages are checked against existing `msg.id` and against `(text, sender_id, timestamp within 2 seconds)` to avoid optimistic update duplication.

### Push Notifications
- `usePushNotifications` hook (loaded in `_layout.tsx` for all users):
  1. Requests Expo push permissions.
  2. Gets the Expo push token.
  3. Upserts the token into the `push_tokens` table (one row per user per device).
- Sending notifications: edge functions call `send-push-notification` which reads the recipient's push token from the DB and calls the Expo Push API.
- Deep links on notification tap: handled in `usePushNotifications` via `Notifications.addNotificationResponseReceivedListener`.

---

## 15. Lease Lifecycle (Full Detail)

```
[Landlord creates draft]
      │
      ▼
   status: "draft"
      │
      ├─► Landlord generates PDF via wizard → generate-lease-pdf
      │   status: "uploaded"
      │
      ├─► Landlord uploads own PDF
      │   status: "uploaded"
      │
      ▼
   [Landlord reviews on lease-preview.tsx, sends via send-lease]
      │
      ▼
   status: "sent" / "generated"
      │
      ▼
   [Tenant receives email, reviews on tenant-lease-review-sign.tsx, signs]
      │
      ▼
   status: "signed" or "signed_pending_move_in"
      │
      ▼
   [Landlord countersigns — notified via notify-landlord-lease-countersign]
      │
      ▼
   status: "active"
      │
      ▼
   [Termination by landlord or end of term]
      │
      ▼
   status: "terminated"
```

**Ontario Standard Lease Sections (from `ontarioLeaseStore`):**
Sections 1–17 mirror the official Ontario LTB Standard Lease Form:
1. Parties (landlord/tenant info)
2. Rental Unit
3. Contact Information
4. Term of Tenancy
5. Rent
6. Services & Utilities (who pays electricity, heat, water, wifi, rental equipment)
7. Rent Discounts
8. Rent Deposit
9. Key Deposit
10. Smoking Policy
11. Tenant's Insurance
12. Changes to Rental Unit (permission required)
13. Assignment & Subletting
14. Additional Terms
15. Signatures
16. Changes to Agreement
17. Other Information

---

## 16. Maintenance Lifecycle

```
[Tenant or Landlord submits request]
        │
        ▼
   status: "new"
        │
        ▼
   [Landlord reviews → assigns urgency/vendor]
        │
        ▼
   status: "under_review" → "in_progress" → "waiting_vendor" → "resolved"
                                                                    │
                                                                    ▼
                                                        [Tenant submits feedback + rating 1–5]
        │
        └─► status: "cancelled" (at any point before resolution)
```

**Urgency levels:** `low`, `medium`, `high`, `emergency`

**Activity log:** Stored as JSONB array on the request row. Every status change, note, or vendor assignment is appended with `{ id, timestamp, message, actor }`.

**Expense linking:** A maintenance request can be linked to a `transactions` record (`expense_id` FK) to track the actual cost.

---

## 17. Accounting & Transactions

- Each transaction has `type` (income|expense), `category` (rent|maintenance|utility|insurance|other), `amount`, `date`, `status` (paid|pending|overdue).
- Transactions can be linked to a property, unit, and/or tenant.
- **Rent Collection calculation** (dashboard):
  - Queries last 12 months of transactions.
  - Filters by selected period (1M/3M/6M/12M).
  - `collected = paid rent transactions in period`.
  - `total = expectedMonthlyRent × numberOfMonths`.
  - `overdue = max(0, total - collected)`.
  - `advance = max(0, collected - total)` (tenant paid more than owed).
- **Income vs Expense chart:** 6-month bar chart, grouped by month.

---

## 18. Marketplace

- `marketplace.tsx` fetches vendors from `vendorService.fetchVendors()`.
- Vendors are categorised (Plumbing, Electrical, HVAC, Landscaping, etc.).
- `isSponsored` flag highlights paid placement with a gold badge.
- Vendor selection for a maintenance request flows through `vendor-select.tsx`.

---

## 19. Edge Cases

### Authentication & Session

| # | Scenario | Current Behaviour | Risk Level |
|---|---|---|---|
| EC-1 | Google OAuth → app crash before role selection | `pendingOAuthSession` lost from in-memory Zustand | User recreated as auth.users row but with no `profiles` row. Next login will create a profile with no role. | Medium |
| EC-2 | `pendingInviteToken` survives logout | Next login redirects to the stored invite | Invite may have expired (7 days). User sees a confusing 410 error. Token never cleaned up on signOut. | Low |
| EC-3 | Same email signs up as both landlord and tenant (different devices) | Supabase won't create duplicate auth users — second signup fails silently or merges | Landlord email used for tenant invite will conflict | Medium |

### Property & Tenant

| # | Scenario | Current Behaviour | Risk Level |
|---|---|---|---|
| EC-4 | Property deactivated while tenant is active | Property shows as `inactive` in landlord list; tenant dashboard still shows "YOUR HOME" | Confusing for both parties — no cascade update on `tenant_property_links` | Medium |
| EC-5 | Tenant linked to multiple active properties | `propertyInfo` on tenant dashboard uses the first active `tenant_property_links` row | Tenant only sees one home; the others are invisible | Medium |
| EC-6 | `getTenantsByProperty()` called before `tenantStore` is loaded | Returns `[]` — "No Tenant is available" alert even if tenants exist | Properties screen loaded before tenants screen → quick-link shows wrong result | Medium |
| EC-7 | Two landlords simultaneously invite the same email to different properties | Both invites created; both `pending`. User accepts first invite; second invite remains pending indefinitely | Two `pending` invites for one user never cleaned up | Low |

### Invite Flow

| # | Scenario | Current Behaviour | Risk Level |
|---|---|---|---|
| EC-8 | Tenant accepts invite from wrong email address | `accept-invite` checks `invite.tenant_email === authenticated user's email` → 403 | Handled correctly ✓ | — |
| EC-9 | Invite token used twice (race condition) | Two concurrent requests both pass the `status='pending'` check before the first marks it `accepted` | `upsert` on `tenant_property_links` is idempotent (same conflict key), but invite could end up as `accepted` twice | Low |
| EC-10 | Invite sent to an email that doesn't exist | GoTrue `inviteUserByEmail()` creates an unverified auth user. If the email bounces, nobody ever clicks the link. The invite row stays `pending` until 7 days expire. | Low |

### Lease

| # | Scenario | Current Behaviour | Risk Level |
|---|---|---|---|
| EC-11 | `pending_signature` not in `DbLease.status` TypeScript union | TypeScript error at compile time; at runtime the comparison works in JavaScript but linters and type-checkers flag it as a dead comparison | Leases with `pending_signature` status may not appear in filtered lists where the filter uses the typed union | Medium |
| EC-12 | Landlord sends lease to tenant with no push token registered | `send-lease` sends the email but the push notification silently fails (catches error) | Tenant still gets the email — acceptable degradation ✓ | — |
| EC-13 | Lease PDF generation with incomplete Ontario form data | `generate-lease-pdf` will attempt to fill missing fields as empty strings | PDF is generated but may contain blank required fields. No validation before generation. | Medium |

### Accounting

| # | Scenario | Current Behaviour | Risk Level |
|---|---|---|---|
| EC-14 | `expectedMonthlyRent = 0` (no rent configured on property) | `total = collected` (no shortfall calculated) — overdue always shows 0 | Dashboard shows 100% collection even when rent is owed | Low |
| EC-15 | Transaction amount entered as negative | No client-side validation; stored as-is. Charts can show negative bars. | Low |

### AraPartner

| # | Scenario | Current Behaviour | Risk Level |
|---|---|---|---|
| EC-16 | Approved referral has no `commission_rules` row | Payout function skips it (no amount calculated) | Partner earns nothing for that month with no error or notification | Medium |
| EC-17 | Monthly payout function triggered multiple times in same month | `UNIQUE(referral_id, payout_month)` constraint prevents duplicate rows | Insert silently fails (upsert or conflict handling needed) — handled ✓ | — |

---

## 20. Security Vulnerabilities

### 🔴 Critical

---

#### VULN-1: `hard-delete-tenant-account` — No Caller Identity or Ownership Verification

**File:** `supabase/functions/hard-delete-tenant-account/index.ts` (line 91)

**Problem:**
```ts
// Only checks that Authorization header starts with "Bearer "
// Never calls supabase.auth.getUser(jwt) to verify WHO is calling
// Never checks that the caller owns the tenant being deleted
const authorHeader = req.headers.get('Authorization');
if (!authorHeader?.startsWith('Bearer ')) {
  return 401;
}
// Immediately proceeds to permanently delete based on userId/tenantId from request body
```

**Impact:** Any HTTP client that sends a request with any `Bearer <anything>` string in the `Authorization` header can permanently delete any tenant account by guessing or enumerating UUIDs. This deletes the auth user, profile, property links, leases, and messages.

**Fix:**
```ts
const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
const { data: authData, error } = await supabase.auth.getUser(jwt);
if (error || !authData?.user) return json({ error: 'Unauthorized' }, 401);

// Verify caller owns the tenant's property
const { data: link } = await supabase
  .from('tenant_property_links')
  .select('landlord_id')
  .eq('tenant_id', tenantId)
  .single();

if (link?.landlord_id !== authData.user.id) return json({ error: 'Forbidden' }, 403);
```

---

#### VULN-2: `generate-monthly-payouts` — No Authentication Whatsoever

**File:** `supabase/functions/generate-monthly-payouts/index.ts`

**Problem:**
```ts
serve(async (req) => {
  // First line of handler — no auth check
  const supabase = createClient(url, serviceKey);
  // Immediately queries referrals and creates payout records
```

**Impact:** Any person on the internet who discovers the edge function URL can POST to it and trigger financial payout calculations. Although `UNIQUE(referral_id, payout_month)` prevents double-row inserts, the function still runs, touches financial data, and logs sensitive information on every unauthenticated call.

**Fix:** Add a shared secret check:
```ts
const secret = req.headers.get('X-Cron-Secret');
if (secret !== Deno.env.get('CRON_SECRET')) {
  return new Response('Unauthorized', { status: 401 });
}
```
Set `X-Cron-Secret` in the Supabase cron schedule configuration.

---

### 🟠 High

---

#### VULN-3: No Rate Limiting on Invite Email Functions

**Files:** `invite-tenant/index.ts`, `invite-applicant/index.ts`

**Problem:** Both functions have no rate limiting. A landlord (or anyone with a stolen landlord JWT) can call these functions in a loop to send unlimited emails to any email address.

**Impact:**
- Email harassment/spam against any email address.
- Supabase transactional email quota exhaustion.
- Costs if on a paid email plan.

**Fix:** Track invites per sender per hour in a Postgres table or use Supabase's rate-limiting features. At minimum, check the number of invites sent in the last hour:
```ts
const { count } = await supabase
  .from('invites')
  .select('id', { count: 'exact', head: true })
  .eq('landlord_id', authData.user.id)
  .gte('created_at', new Date(Date.now() - 3600000).toISOString());

if (count >= 20) return json({ error: 'Rate limit exceeded' }, 429);
```

---

#### VULN-4: File Upload MIME Type Not Validated Against Actual File Content

**File:** `lib/supabase.ts → uploadImage()` (line 299)

**Problem:**
```ts
const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
// content-type derived from filename extension, not actual bytes
const contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
```

Any file (JavaScript, HTML, PHP, etc.) can be uploaded to the `property-images` or `tenant-photos` buckets by renaming it with an image extension. The `maintenance-attachments` bucket has server-side MIME type restrictions, but the other two buckets do not.

**Impact:** Stored XSS if the bucket is public and the content-type is set to `text/html`. Server-side execution is unlikely on Supabase Storage, but malicious files sitting in public buckets can be used for phishing or to serve malware.

**Fix:**
1. Read the first few bytes (magic numbers) to determine actual file type.
2. Or, restrict buckets to known MIME types in Supabase Storage settings.
3. At minimum, restrict `property-images` and `tenant-photos` buckets:
```sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/gif']
WHERE id IN ('property-images', 'tenant-photos');
```

---

#### VULN-5: `INVITE_TOKEN_PEPPER` Falls Back to Empty String in `accept-invite`

**File:** `supabase/functions/accept-invite/index.ts` (line ~28)

**Problem:**
```ts
const tokenPepper = Deno.env.get('INVITE_TOKEN_PEPPER') || '';
// If env var not set, all tokens are hashed without a pepper
```

`invite-tenant` (correctly) returns 500 if the pepper is missing. But `accept-invite` silently falls back to an empty pepper. If `INVITE_TOKEN_PEPPER` is accidentally unset in production, invite tokens are SHA-256 hashed without any secret, making them predictable from the raw token value.

**Fix:**
```ts
const tokenPepper = Deno.env.get('INVITE_TOKEN_PEPPER');
if (!tokenPepper) {
  return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 });
}
```

Apply the same guard to `decline-invite` and `get-invite`.

---

### 🟡 Medium

---

#### VULN-6: User Role Persisted to and Read from Client-Side Storage

**File:** `store/authStore.ts` (lines 149–162, 204–205)

**Problem:**
```ts
// Role resolved from: DB profile → user_metadata → cached AsyncStorage value
const role = profile?.user_type ||
  (user.user_metadata?.role as UserRole) ||
  (user.user_metadata?.user_type as UserRole) ||
  (await getStorageValue('userRole')) as UserRole;
```

On web, `localStorage` is readable by any JavaScript on the same origin. If an XSS vulnerability is ever introduced, an attacker could change the stored `userRole` to `landlord` and see the landlord dashboard. While server-side RLS still enforces real access control, the attacker would see UI components and data shapes not intended for tenants.

**Fix:** Never use the cached `localStorage` value to assign the role. Always derive role from the live DB profile response.

---

#### VULN-7: 318 `console.log` / `console.error` Calls in `lib/supabase.ts`

**Problem:**
```ts
// Examples of what gets logged:
console.log('📧 Sending invite to:', tenantEmail);
console.log('Tenant data:', tenantData); // includes name, email, phone
console.error('Lease update error:', leaseId, error);
```

On web, all these logs appear in the browser's Developer Console — visible to any user who opens DevTools. On native, they appear in device logs readable via `adb logcat` (Android) or Console.app (iOS) and in crash reporting tools if those are integrated.

**Fix:** Use a logger that strips logs in production:
```ts
const log = process.env.NODE_ENV === 'production'
  ? { log: () => {}, error: console.error, warn: console.warn }
  : console;
```
Or use `babel-plugin-transform-remove-console` in the build pipeline.

---

#### VULN-8: TOCTOU Race Condition on Invite Token Acceptance

**File:** `supabase/functions/accept-invite/index.ts` (lines 62–112)

**Problem:** The invite status check and the status update are two separate operations with no transaction or locking:
```ts
// Step 1: Check (SELECT)
if (invite.status !== 'pending') return 409;
if (new Date(invite.expires_at) <= new Date()) return 410;

// Gap here — another request with the same token can pass the check above

// Step 2: Update (UPDATE)
await supabase.from('invites').update({ status: 'accepted' }).eq('id', invite.id);
```

**Fix:** Use an atomic update that only succeeds if `status = 'pending'`:
```ts
const { data, count } = await supabase
  .from('invites')
  .update({ status: 'accepted', used_at: new Date().toISOString() })
  .eq('id', invite.id)
  .eq('status', 'pending')  // atomic guard
  .gt('expires_at', new Date().toISOString())
  .select()
  .single();

if (!data) return json({ error: 'Invite already used or expired' }, 409);
```

---

#### VULN-9: Chat — No Server-Side Participant Verification in `messageService`

**File:** `services/messageService.ts → getMessages(conversationId)`

**Problem:**
```ts
// Fetches messages by conversation ID with no check that caller is a participant
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true });
```

If RLS on the `messages` table does not enforce `auth.uid() IN (SELECT tenant_id, landlord_id FROM conversations WHERE id = conversation_id)`, any authenticated user who guesses a conversation UUID can read all messages.

**Fix:** Ensure `messages` RLS policy enforces participant membership:
```sql
CREATE POLICY "participants_only"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE tenant_id = auth.uid()
         OR landlord_id = auth.uid()
         OR manager_id = auth.uid()
    )
  );
```

---

#### VULN-10: `resolve-tenant copy/` Directory — Accidental Deployment Risk

**Location:** `supabase/functions/resolve-tenant copy/`

A directory named `resolve-tenant copy` (with a space) exists alongside `resolve-tenant`. Both contain copies of the same sub-functions (accept-invite, decline-invite, get-invite, invite-applicant, invite-tenant). If accidentally included in a `supabase functions deploy` command, an extra set of endpoints could be deployed, causing unpredictable routing or duplicated operations.

**Fix:** Delete the directory immediately:
```bash
rm -rf "supabase/functions/resolve-tenant copy"
```

---

### 🔵 Low

---

#### VULN-11: `debug-properties.tsx` Screen Exposed in Production Bundle

**File:** `app/debug-properties.tsx`

The screen is registered in the router bundle and accessible at `/debug-properties`. While it likely requires authentication, it may expose internal property data, raw store state, or DB query results in an uncontrolled format.

**Fix:** Remove or gate behind an `admin` role check, or exclude from production builds via Expo build config.

---

#### VULN-12: `EXPO_PUBLIC_*` Variables Baked into App Bundle

**File:** `lib/supabase.ts` (lines 18–19)

```ts
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
```

`EXPO_PUBLIC_*` variables are baked into the JavaScript bundle and visible to anyone who extracts and decompiles the app. The `supabaseAnonKey` (anon key) is designed to be public — it only grants access per RLS policies. However, if RLS policies have any gaps, the anon key is enough to exploit them.

This is **by design for Supabase** (anon key is public), but all RLS policies must be correct for this to remain safe.

---

## 21. Known Pre-existing Code Issues

These are TypeScript or logic errors that existed before recent changes. They are **not introduced by recent edits** but should be addressed.

| File | Line | Issue | Impact |
|---|---|---|---|
| `tenant-dashboard.tsx` | ~100 | `'pending_signature'` compared against `DbLease.status` union that doesn't include it | Leases with `pending_signature` status excluded from pending-lease filter |
| `tenant-dashboard.tsx` | ~746, ~827 | `styles.welcomeCard` referenced but not defined in StyleSheet | Runtime error / warning on screens using that style |
| `tenant-dashboard.tsx` | ~661 | `index` variable declared in `.map()` but never used | Harmless — linter warning |
| `lib/supabase.ts` | ~2027 | Reference to `ADD_TENANT_ID_MIGRATION.sql` in console.warn | Migration may not have been applied in production |
| `lib/supabase.ts` | ~3277 | Reference to `FIX_LEASE_RLS_FOR_APPLICANTS.sql` in console.error | RLS policy for tenant lease updates may be missing |
| `properties.tsx` | ~43 | `isLoading` declared but its value is never read | Harmless — linter hint |

---

## Summary: Priority Matrix

| Priority | ID | Issue | Effort to Fix |
|---|---|---|---|
| 🔴 Critical | VULN-1 | `hard-delete-tenant-account` — no identity/ownership check | Low (add 10 lines) |
| 🔴 Critical | VULN-2 | `generate-monthly-payouts` — zero authentication | Low (add secret header check) |
| 🟠 High | VULN-3 | No rate limiting on invite email functions | Medium |
| 🟠 High | VULN-4 | File uploads: MIME not validated from file bytes | Medium |
| 🟠 High | VULN-5 | Token pepper silently empty in `accept-invite` | Low (add guard) |
| 🟡 Medium | VULN-6 | Role cached in localStorage — XSS escalation risk | Medium |
| 🟡 Medium | VULN-7 | 318 console.logs leaking PII in production | Medium |
| 🟡 Medium | VULN-8 | TOCTOU race on invite acceptance | Low (atomic UPDATE) |
| 🟡 Medium | VULN-9 | Chat RLS may allow cross-tenant reads | Low (SQL policy) |
| 🟡 Medium | VULN-10 | `resolve-tenant copy/` accidental deployment risk | Low (delete directory) |
| 🔵 Low | VULN-11 | `debug-properties.tsx` exposed in production | Low (remove file) |
| 🔵 Low | VULN-12 | Anon key baked into bundle (by design, but RLS must be correct) | Ongoing vigilance |

---

*Last updated: June 2026*
