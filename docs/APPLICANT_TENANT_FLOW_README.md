# Applicant vs Tenant Flow (Aaralink)

This document explains the full lifecycle in your app:

1. What an **Applicant** is
2. What a **Tenant** is
3. How a person moves from applicant → lease → tenant
4. How co-applicants are handled
5. Which tables and screens are involved
6. Common edge cases and how the app handles them

---

## 1) Core Concept

### Applicant
An applicant is someone who has applied for a property but is **not yet an active tenant record**.

- Source table: `applications`
- Typical status values: `submitted`, `under_review`, `approved`, `rejected`
- May include additional people in `co_applicants`
- Can have a lease draft generated against `application_id`

### Tenant
A tenant is someone who has been onboarded into the tenancy model.

- Source table: `tenants`
- A tenant must be linked to a property through `tenant_property_links`
- Lease can reference `tenant_id` once conversion is done
- Tenant dashboard logic reads tenant record first, then property links

---

## 2) Data Model in This Flow

## Main Tables

### `applications`
Stores rental applications before conversion.

Important fields:
- `id`
- `user_id` (applicant auth user id)
- `property_id`, `unit_id`, `sub_unit_id`
- `applicant_name`, `applicant_email`, `applicant_phone`
- `status`
- `form_data`

### `co_applicants`
Stores additional applicants attached to one primary application.

Important fields:
- `application_id`
- `full_name`, `email`, `phone`
- `applicant_order`

### `leases`
Stores lease records and generated/uploaded documents.

Important fields in this flow:
- `id`
- `application_id` (for applicant-based leases before conversion)
- `tenant_id` (set after conversion)
- `property_id`, `unit_id`
- `status` (`draft`, `generated`, `uploaded`, `sent`, `signed`)
- `document_url`

### `tenants`
Stores active tenant profile used by landlord/tenant views.

Important fields:
- `id` (tenant record id)
- `user_id` (auth user id)
- `first_name`, `last_name`, `email`, `phone`
- `property_id`, `unit_id`
- `status`

### `tenant_property_links`
Authoritative mapping between tenant record and property context.

Important fields:
- `tenant_id` (**points to `tenants.id`**, not auth id)
- `property_id`, `unit_id`, `sub_unit_id`
- `status`
- `created_via` (e.g. `lease_creation`)

### `co_tenants`
Stores converted co-applicants associated to a tenancy link.

Important fields:
- `tenant_id` (**stores `tenant_property_links.id` in current implementation**)
- `property_id`
- `full_name`, `email`, `phone`
- `co_applicant_id`

---

## 3) End-to-End Lifecycle

## Step A: Applicant submits application
Function path: `submitApplication(...)` in `lib/supabase.ts`

What happens:
1. Insert into `applications` with status `submitted`
2. Insert each co-applicant into `co_applicants` (if provided)
3. Notify landlord

Result: person exists as **Applicant**, not tenant yet.

---

## Step B: Landlord reviews application
Screen paths:
- `app/landlord-applications.tsx`
- `app/landlord-application-review.tsx`

What landlord can do:
- Approve application
- Generate lease from approved application
- Convert directly (if lease exists)

When generating lease from application:
- Wizard is pre-filled with primary applicant + co-applicant names
- Navigation goes to lease wizard step 1

---

## Step C: Lease is created/generated/sent
Main components:
- Lease wizard (`app/lease-wizard/*`)
- Store (`store/ontarioLeaseStore.ts`)
- Send function (`supabase/functions/send-lease/index.ts`)

Behavior:
1. Lease draft is saved with `application_id` (for applicant flow)
2. Document generated/uploaded
3. “Send to Tenant” sends to:
   - `tenants.email` if `lease.tenant_id` exists
   - else `applications.applicant_email` if this is still applicant-based
4. Lease status moves to `sent`

Important: sending a lease does **not** itself convert applicant to tenant.

---

## Step D: Applicant signs lease → conversion to tenant
Conversion trigger path:
- Tenant-side lease detail screen (`app/tenant-lease-detail.tsx`)
- Calls `handleLeaseSigning(...)` → `convertApplicantToTenant(...)`

`convertApplicantToTenant(...)` does:
1. Validate lease isn’t already converted (`lease.tenant_id` check)
2. Load application
3. Resolve applicant auth id:
   - prefer `application.user_id`
   - fallback lookup by `profiles.email`
4. Insert row into `tenants`
5. Insert row into `tenant_property_links` (`created_via = lease_creation`)
6. Move `co_applicants` into `co_tenants`
7. Update lease:
   - set `tenant_id`
   - set status `signed`
   - set `signed_date`
8. Delete original application row

Result: person is now in the **Tenant model** and appears in tenant listings.

---

## 4) Co-Applicant / Co-Tenant Flow

### Before conversion
- Stored as `co_applicants` attached to an application
- Shown in lease wizard suggestions under approved applicant

### After conversion
- Copied to `co_tenants`
- Linked to tenancy context via link id
- Displayed in tenant surfaces (tenant dashboard and tenant detail where loaded)

---

## 5) Where Each UI Uses This Data

## Landlord side
- Applications list: `app/landlord-applications.tsx`
  - reads approved apps
  - checks if lease exists
  - supports generate lease and convert

- Tenant list/detail:
  - `app/tenants.tsx`
  - `app/tenant-detail.tsx`
  - reads from `tenants` (and co-tenants where loaded)

## Tenant side
- Dashboard: `app/(tabs)/tenant-dashboard.tsx`
  - finds `tenants` by `user_id = auth.uid()`
  - then finds `tenant_property_links` by `tenant_id = tenants.id`
  - loads co-tenants from `co_tenants`

- Lease signing: `app/tenant-lease-detail.tsx`
  - signing an applicant-based lease runs conversion

---

## 6) Status/Stage Map

| Stage | Primary Record | Key Status | Notes |
|---|---|---|---|
| Applied | `applications` | `submitted` | person is applicant |
| Approved | `applications` | `approved` | eligible for lease generation |
| Lease prepared | `leases` | `draft/generated/uploaded` | often still tied to `application_id` |
| Lease sent | `leases` | `sent` | email can go to applicant email |
| Lease signed + converted | `tenants` + `tenant_property_links` + `leases` | lease `signed`, tenant `active` | `application` removed |

---

## 7) Important Rules (Current Implementation)

1. **Applicant ≠ Tenant** until conversion executes.
2. Conversion requires a valid auth UUID for the applicant (`user_id`), not email text.
3. `tenant_property_links.tenant_id` references **tenant record id** (`tenants.id`).
4. Lease can exist before tenant conversion by using `application_id`.
5. Co-applicants are persisted separately and transformed into co-tenants at conversion time.

---

## 8) Common Failure Modes

### “Invalid input syntax for type uuid” during conversion
Cause:
- Trying to insert email into UUID field (`tenants.user_id`).

Fix:
- Use `application.user_id` or profile-id lookup by email; never email as UUID.

### “Lease not found” on send
Possible cause:
- Edge function join mismatch in property fields.

Current expected property fields in `send-lease`:
- `address1`, `city`, `state`, `zip_code`

### Applicant approved but not visible as tenant
Expected until conversion:
- They remain applicant until signed flow runs conversion.

---

## 9) Practical Mental Model

Think of it as two phases:

1. **Screening phase (Applications)**
   - `applications`, `co_applicants`

2. **Occupancy phase (Tenancy)**
   - `tenants`, `tenant_property_links`, `co_tenants`

The **lease** bridges the two phases.
- It can start tied to application
- After signing, it gets tied to tenant record

---

## 10) Recommended Operational Flow for Team

1. Tenant submits application
2. Landlord approves
3. Landlord generates and sends lease
4. Applicant signs lease
5. System converts applicant → tenant
6. Tenant appears in tenant list/dashboard with co-tenants

If step 5 does not happen, the person is still in applicant phase even if lease exists.
