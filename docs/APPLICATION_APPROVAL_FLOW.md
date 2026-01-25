# Application Review & Approval Flow

## Overview
Complete implementation of the landlord application review and approval workflow with tenant conversion functionality.

## Features Implemented

### 1. **Application Review Screen** (`landlord-application-review.tsx`)
- ✅ Loads real application data from database using `getApplicationById()`
- ✅ Displays applicant information (name, email, phone, property address)
- ✅ Shows application data (employment, rental history) if available
- ✅ **Reject Application**: Sends notification to tenant with rejection message
- ✅ **Approve Application**: Shows dialog with two options:
  - **Add as Tenant Now**: Opens add-tenant screen with prefilled data
  - **Do it Later**: Marks as approved and returns to listing
- ✅ Only shows action buttons if status is 'submitted'
- ✅ Shows status info for already processed applications

### 2. **API Functions** (`lib/supabase.ts`)

#### `approveApplication(applicationId, shouldAddTenant)`
- Updates application status to 'approved'
- Sends approval notification to tenant:
  - Title: "Application Approved! 🎉"
  - Message: "Your application for {property-address} has been approved!"
- Returns success status and application data

#### `rejectApplication(applicationId, reason?)`
- Updates application status to 'rejected'
- Optionally stores rejection reason
- Sends rejection notification to tenant:
  - Title: "Application Update"
  - Message: "Your application for {property-address} has been reviewed."
- Returns success status

#### `getApplicationById(applicationId)`
- Fetches complete application details
- Includes property address formatted from address components
- Returns application with all data needed for review

### 3. **Applications Listing** (`landlord-applications.tsx`)
- ✅ Shows all applications with status badges
- ✅ **"Add as Tenant" Button**: Appears for approved applications
  - Styled with blue background and account-plus icon
  - Navigates to add-tenant screen with `applicationId` parameter
  - Prevents click-through to review screen (stopPropagation)
- ✅ Status color coding:
  - `submitted`: Orange
  - `approved`: Green
  - `rejected`: Red

### 4. **Add Tenant Screen** (`add-tenant.tsx`)
- ✅ Accepts `applicationId` query parameter
- ✅ Automatically loads application data when applicationId present
- ✅ Prefills form fields:
  - First Name (parsed from applicant_name)
  - Last Name (parsed from applicant_name)
  - Email
  - Phone
  - Property (propertyId)
  - Unit (unitId if available)
  - Sub-unit (subUnitId if available)
- ✅ Landlord can review/edit prefilled data before submitting

## User Flow

### Scenario 1: Approve & Add Tenant Immediately
1. Landlord clicks application in listing
2. Reviews application details
3. Clicks "Approve Application"
4. Dialog appears: "Do you want to add this applicant as a tenant now?"
5. Clicks "Add as Tenant Now"
6. Redirects to add-tenant screen with all data prefilled
7. Landlord reviews/edits and clicks Submit
8. Tenant is created in database
9. **Tenant receives approval notification**

### Scenario 2: Approve & Add Tenant Later
1. Landlord clicks application in listing
2. Reviews application details
3. Clicks "Approve Application"
4. Clicks "Do it Later"
5. Application marked as approved
6. Returns to applications listing
7. **"Add as Tenant" button appears** on that application card
8. Later, landlord clicks "Add as Tenant" button
9. Opens add-tenant screen with prefilled data
10. Landlord submits to create tenant
11. **Tenant receives approval notification when approved**

### Scenario 3: Reject Application
1. Landlord clicks application in listing
2. Reviews application details
3. Clicks "Reject Application"
4. Confirmation alert appears
5. Clicks "Reject"
6. Application marked as rejected
7. **Tenant receives rejection notification**
8. Returns to applications listing

## Notifications

### Approval Notification (to Tenant)
```json
{
  "type": "application_approved",
  "title": "Application Approved! 🎉",
  "message": "Your application for {property-address} has been approved!",
  "data": {
    "applicationId": "...",
    "propertyId": "...",
    "propertyAddress": "...",
    "status": "approved"
  }
}
```

### Rejection Notification (to Tenant)
```json
{
  "type": "application_rejected",
  "title": "Application Update",
  "message": "Your application for {property-address} has been reviewed.",
  "data": {
    "applicationId": "...",
    "propertyId": "...",
    "propertyAddress": "...",
    "status": "rejected",
    "reason": "..." // optional
  }
}
```

## Database Updates

### Applications Table Columns Used
- `id`: Application UUID
- `status`: Updated to 'approved' or 'rejected'
- `applicant_name`: Full name
- `applicant_email`: Email address
- `applicant_phone`: Phone number
- `property_id`: Property reference
- `unit_id`: Unit reference (if applicable)
- `sub_unit_id`: Sub-unit reference (if applicable)
- `application_data`: JSONB with employment, residence details
- `rejection_reason`: Optional rejection reason text
- `updated_at`: Timestamp of status change

## Technical Details

### Modal Dialog (Approval Screen)
- Transparent overlay with centered content
- Three buttons:
  1. "Add as Tenant Now" - Primary action (blue)
  2. "Do it Later" - Secondary action (outlined)
  3. "Cancel" - Tertiary action (text only)

### Status Badge Styling
Uses 20% opacity background with full-color text:
- `backgroundColor: ${getStatusColor(status)}20`
- `color: getStatusColor(status)`

### Button Interaction
"Add as Tenant" button uses `stopPropagation()` to prevent triggering parent's onPress (which would navigate to review screen)

## Testing Checklist

- [ ] Approve application → Select "Do Now" → Verify redirect to add-tenant with prefilled data
- [ ] Approve application → Select "Do Later" → Verify "Add as Tenant" button appears in listing
- [ ] Click "Add as Tenant" button → Verify form is prefilled correctly
- [ ] Reject application → Verify tenant receives rejection notification
- [ ] Approve application → Verify tenant receives approval notification
- [ ] Submit tenant from prefilled form → Verify tenant is created successfully
- [ ] Check that processed applications show status instead of action buttons

## Files Modified

1. `lib/supabase.ts` - Added 3 new functions (approveApplication, rejectApplication, getApplicationById)
2. `app/landlord-application-review.tsx` - Complete rewrite with approval dialog
3. `app/landlord-applications.tsx` - Added "Add as Tenant" button for approved applications
4. `app/add-tenant.tsx` - Added applicationId param handling and prefill logic

## Next Steps

1. Run the ADD_INVITE_ID_TO_APPLICATIONS.sql migration (if not done already)
2. Test the complete flow end-to-end
3. Consider adding:
   - Rejection reason input field
   - Application history/audit log
   - Ability to mark tenant as "added" to hide the button
   - Bulk approve/reject functionality
