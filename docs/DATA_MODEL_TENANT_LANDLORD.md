# Tenant-Landlord Property Management Data Model

## 1. DATABASE SCHEMA

### Core Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  user_type ENUM('landlord', 'tenant', 'both') NOT NULL DEFAULT 'tenant',
  profile_picture_url TEXT,
  is_active BOOLEAN DEFAULT true,
  account_status ENUM('active', 'pending', 'invited', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Constraints
  CONSTRAINT email_not_empty CHECK (email != '')
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
```

#### `properties`
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_type ENUM('single_unit', 'multi_unit', 'commercial', 'parking') DEFAULT 'multi_unit',
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  country VARCHAR(100) DEFAULT 'US',
  
  -- Property details
  total_units INTEGER DEFAULT 1,
  description TEXT,
  property_image_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT address_not_empty CHECK (address != '')
);

-- Indexes
CREATE INDEX idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX idx_properties_is_active ON properties(is_active);
```

#### `units` (for multi_unit properties)
```sql
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number VARCHAR(50) NOT NULL,
  unit_type ENUM('studio', '1bed', '2bed', '3bed', 'other') DEFAULT 'other',
  monthly_rent DECIMAL(10, 2),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT unit_number_not_empty CHECK (unit_number != ''),
  UNIQUE(property_id, unit_number)
);

-- Indexes
CREATE INDEX idx_units_property_id ON units(property_id);
```

#### `sub_units` (for rooms within units)
```sql
CREATE TABLE sub_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sub_unit_number VARCHAR(50) NOT NULL,
  monthly_rent DECIMAL(10, 2),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT sub_unit_number_not_empty CHECK (sub_unit_number != ''),
  UNIQUE(unit_id, sub_unit_number)
);

-- Indexes
CREATE INDEX idx_sub_units_unit_id ON sub_units(unit_id);
```

#### `tenant_property_links` (PRIMARY CONNECTION TABLE)
```sql
CREATE TABLE tenant_property_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  sub_unit_id UUID REFERENCES sub_units(id) ON DELETE SET NULL,
  
  -- Link status
  status ENUM('active', 'pending_invite', 'inactive', 'removed') DEFAULT 'active',
  
  -- Connection origin
  created_via ENUM('landlord_invite', 'lease_creation', 'application_approval') DEFAULT 'landlord_invite',
  created_by_user_id UUID NOT NULL REFERENCES users(id), -- who created this link
  
  -- Dates
  link_start_date DATE,
  link_end_date DATE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Constraints
  UNIQUE(tenant_id, property_id, unit_id, sub_unit_id),
  CONSTRAINT valid_dates CHECK (link_end_date IS NULL OR link_start_date <= link_end_date)
);

-- Indexes
CREATE INDEX idx_tenant_property_links_tenant_id ON tenant_property_links(tenant_id);
CREATE INDEX idx_tenant_property_links_property_id ON tenant_property_links(property_id);
CREATE INDEX idx_tenant_property_links_status ON tenant_property_links(status);
CREATE INDEX idx_tenant_property_links_unit_id ON tenant_property_links(unit_id);
```

#### `leases`
```sql
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  sub_unit_id UUID REFERENCES sub_units(id) ON DELETE SET NULL,
  
  -- Lease details
  lease_start_date DATE NOT NULL,
  lease_end_date DATE,
  monthly_rent DECIMAL(10, 2) NOT NULL,
  security_deposit DECIMAL(10, 2),
  lease_terms TEXT,
  
  -- Status
  status ENUM('draft', 'pending_signature', 'active', 'completed', 'terminated') DEFAULT 'draft',
  
  -- Signature tracking
  landlord_signed BOOLEAN DEFAULT false,
  tenant_signed BOOLEAN DEFAULT false,
  landlord_signature_date TIMESTAMP,
  tenant_signature_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT lease_dates CHECK (lease_end_date IS NULL OR lease_start_date <= lease_end_date)
);

-- Indexes
CREATE INDEX idx_leases_property_id ON leases(property_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX idx_leases_status ON leases(status);
```

#### `applications`
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Application details
  application_status ENUM('submitted', 'under_review', 'approved', 'rejected', 'withdrawn') DEFAULT 'submitted',
  application_date TIMESTAMP DEFAULT now(),
  
  -- Tenant info in application (may differ from user profile)
  applicant_email VARCHAR(255) NOT NULL,
  applicant_name VARCHAR(255) NOT NULL,
  applicant_phone VARCHAR(20),
  monthly_income DECIMAL(10, 2),
  employment_info TEXT,
  references TEXT,
  
  -- Landlord response
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_date TIMESTAMP,
  rejection_reason TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_applications_tenant_id ON applications(tenant_id);
CREATE INDEX idx_applications_property_id ON applications(property_id);
CREATE INDEX idx_applications_status ON applications(application_status);
CREATE INDEX idx_applications_unique ON applications(tenant_id, property_id, application_status) 
  WHERE application_status IN ('submitted', 'under_review');
```

---

## 2. RELATIONSHIP MAPPING (ER DIAGRAM LOGIC)

```
┌─────────────────────────────────────────────────────────┐
│                        PROPERTY                         │
│                   (Central Entity)                       │
│  - id, address, landlord_id                             │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ├─ (1:N) ─────────────┤                    │
         │                    │                    │
    LANDLORD/PM          UNITS              APPLICATIONS
  (users table)       (multi_unit)         (tenant applies)
   user_type='          │                       │
   landlord'        OWNS                        │
                  /   |  \                      │
            ROOMS   COMMON   PARKING        LINKED BY
           (sub_units)       (commercial)      │
                                               │
         ┌──────────────────────────────────────┘
         │
    ON APPROVAL
         │
    CREATES
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│          TENANT_PROPERTY_LINKS                          │
│       (Connection Table)                                │
│  - tenant_id, property_id, unit_id, status             │
└─────────────────────────────────────────────────────────┘
         │
         ├─ TENANT (users.id)
         ├─ PROPERTY (properties.id)
         ├─ UNIT (units.id) - optional
         └─ SUB_UNIT (sub_units.id) - optional

AND

┌─────────────────────────────────────────────────────────┐
│              LEASE                                      │
│  - property_id, tenant_id, unit_id, lease_start_date  │
└─────────────────────────────────────────────────────────┘
         │
         ├─ TENANT (users.id)
         └─ PROPERTY (properties.id)
```

---

## 3. API FLOW FOR EACH CASE

### CASE 1: Landlord Adds Tenant to Property

**Endpoint:** `POST /api/properties/{propertyId}/tenants/add`

**Request:**
```json
{
  "tenant_email": "john@example.com",
  "tenant_name": "John Doe",
  "unit_id": "uuid-of-unit",
  "link_start_date": "2026-02-01"
}
```

**Flow:**

```
1. VALIDATE
   ├─ Verify landlord owns the property
   ├─ Verify unit belongs to property (if provided)
   └─ Check email is valid

2. LOOKUP TENANT
   ├─ Query: SELECT * FROM users WHERE email = 'john@example.com'
   │
   ├─ IF tenant exists:
   │  └─ CASE A: User with email already exists
   │     ├─ Check if already linked to property
   │     └─ If not linked → CREATE tenant_property_links
   │
   └─ IF tenant NOT found:
      └─ CASE B: Create new tenant
         ├─ INSERT into users with:
         │  - email: 'john@example.com'
         │  - full_name: 'John Doe'
         │  - user_type: 'tenant'
         │  - account_status: 'invited'
         │
         └─ CREATE tenant_property_links with:
            ├─ tenant_id: (new user id)
            ├─ property_id: propertyId
            ├─ unit_id: unit_id (if provided)
            ├─ status: 'pending_invite'
            ├─ created_via: 'landlord_invite'
            ├─ created_by_user_id: landlord_id
            └─ link_start_date: provided date

3. SEND NOTIFICATION
   ├─ Email tenant: "You've been added to {property_address}"
   ├─ If pending_invite: include invite link to activate account
   └─ If existing user: simple notification

4. RETURN
   └─ tenant_property_links record with status
```

**SQL Operations:**

```sql
-- Check if tenant exists
SELECT id, user_type, account_status FROM users WHERE email = $1;

-- Create new tenant if not exists
INSERT INTO users (email, full_name, user_type, account_status)
VALUES ($1, $2, 'tenant', 'invited')
RETURNING id;

-- Create tenant-property link
INSERT INTO tenant_property_links 
  (tenant_id, property_id, unit_id, status, created_via, created_by_user_id, link_start_date)
VALUES ($1, $2, $3, 'pending_invite', 'landlord_invite', $4, $5)
RETURNING *;
```

**Edge Cases:**
- **Duplicate email, different user**: Link existing user to property
- **Re-invite**: Update existing link status from 'inactive' to 'active'
- **Already linked**: Return error "Tenant already linked to this property" or update if inactive
- **Email typo**: Validate email format before creating user

---

### CASE 2: Landlord Generates Lease

**Endpoint:** `POST /api/leases/create`

**Request:**
```json
{
  "property_id": "uuid-of-property",
  "tenant_email": "john@example.com",
  "tenant_name": "John Doe",
  "unit_id": "uuid-of-unit",
  "lease_start_date": "2026-02-01",
  "lease_end_date": "2027-01-31",
  "monthly_rent": 1500,
  "security_deposit": 3000,
  "lease_terms": "Standard terms..."
}
```

**Flow:**

```
1. VALIDATE
   ├─ Verify landlord owns the property
   ├─ Verify unit belongs to property (if provided)
   └─ Validate dates and amounts

2. RESOLVE TENANT
   ├─ Query: SELECT * FROM users WHERE email = 'john@example.com'
   │
   ├─ IF tenant exists:
   │  └─ tenant_id = existing_user.id
   │
   └─ IF tenant NOT found:
      └─ CREATE new tenant
         ├─ INSERT into users with:
         │  - email: 'john@example.com'
         │  - full_name: 'John Doe'
         │  - user_type: 'tenant'
         │  - account_status: 'active' (since lease is being created)
         │
         └─ tenant_id = new_user.id

3. CHECK TENANT-PROPERTY LINK
   ├─ Query: SELECT * FROM tenant_property_links 
   │          WHERE tenant_id = $1 AND property_id = $2
   │
   ├─ IF link exists:
   │  └─ Use existing link
   │
   └─ IF link NOT exists:
      └─ CREATE tenant_property_links with:
         ├─ tenant_id: tenant_id
         ├─ property_id: property_id
         ├─ unit_id: unit_id (if provided)
         ├─ status: 'active'
         ├─ created_via: 'lease_creation' ← KEY: Lease itself creates connection
         ├─ created_by_user_id: landlord_id
         └─ link_start_date: lease_start_date

4. CREATE LEASE
   └─ INSERT into leases:
      ├─ property_id: property_id
      ├─ tenant_id: tenant_id
      ├─ unit_id: unit_id
      ├─ lease_start_date: provided date
      ├─ lease_end_date: provided date
      ├─ monthly_rent: provided amount
      ├─ security_deposit: provided amount
      ├─ lease_terms: provided terms
      ├─ status: 'pending_signature'
      ├─ landlord_signed: false
      └─ tenant_signed: false

5. SEND NOTIFICATIONS
   ├─ Email tenant: "A lease has been generated for {property}"
   ├─ If new user: include account activation link
   └─ Include lease PDF for review

6. RETURN
   └─ lease record with status 'pending_signature'
```

**SQL Operations:**

```sql
-- Check if tenant exists
SELECT id FROM users WHERE email = $1;

-- Create new tenant if not exists
INSERT INTO users (email, full_name, user_type, account_status)
VALUES ($1, $2, 'tenant', 'active')
RETURNING id;

-- Check existing link
SELECT id, status FROM tenant_property_links 
WHERE tenant_id = $1 AND property_id = $2;

-- Create link if not exists
INSERT INTO tenant_property_links 
  (tenant_id, property_id, unit_id, status, created_via, created_by_user_id, link_start_date)
VALUES ($1, $2, $3, 'active', 'lease_creation', $4, $5)
ON CONFLICT (tenant_id, property_id, unit_id, sub_unit_id) 
DO UPDATE SET status = 'active'
RETURNING id;

-- Create lease
INSERT INTO leases 
  (property_id, tenant_id, unit_id, lease_start_date, lease_end_date, 
   monthly_rent, security_deposit, lease_terms, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_signature')
RETURNING *;
```

**Key Difference from Case 1:**
- **Case 1**: Tenant link is `pending_invite`
- **Case 2**: Tenant link is `active` (because lease is formal agreement)

---

### CASE 3: Tenant Applies for Property

**Endpoint:** `POST /api/applications/submit`

**Request:**
```json
{
  "property_id": "uuid-of-property",
  "applicant_email": "jane@example.com",
  "applicant_name": "Jane Doe",
  "applicant_phone": "555-1234",
  "monthly_income": 5000,
  "employment_info": "Software Engineer at Company XYZ",
  "references": "Previous landlord contact..."
}
```

**Flow:**

```
1. VALIDATE
   ├─ Verify property exists
   ├─ Verify property is active
   └─ Verify applicant email is valid

2. RESOLVE APPLICANT
   ├─ Query: SELECT id FROM users WHERE email = 'jane@example.com'
   │
   ├─ IF user exists:
   │  └─ tenant_id = existing_user.id
   │
   └─ IF user NOT found:
      └─ CREATE new tenant
         ├─ INSERT into users with:
         │  - email: 'jane@example.com'
         │  - full_name: 'Jane Doe'
         │  - user_type: 'tenant'
         │  - account_status: 'active'
         │
         └─ tenant_id = new_user.id

3. CREATE APPLICATION
   └─ INSERT into applications:
      ├─ tenant_id: tenant_id
      ├─ property_id: property_id
      ├─ application_status: 'submitted'
      ├─ applicant_email: applicant_email
      ├─ applicant_name: applicant_name
      ├─ applicant_phone: applicant_phone
      ├─ monthly_income: monthly_income
      ├─ employment_info: employment_info
      ├─ references: references
      └─ application_date: now()

4. GET LANDLORD
   └─ Query: SELECT landlord_id FROM properties WHERE id = property_id
      └─ landlord_id = property.landlord_id

5. NOTIFY LANDLORD
   ├─ Send notification to landlord
   ├─ "New application from Jane Doe for {property_address}"
   └─ Include application review link

6. RETURN
   └─ application record with status 'submitted'
```

**SQL Operations:**

```sql
-- Check if applicant is existing user
SELECT id FROM users WHERE email = $1;

-- Create new applicant if not exists
INSERT INTO users (email, full_name, user_type, account_status)
VALUES ($1, $2, 'tenant', 'active')
RETURNING id;

-- Create application
INSERT INTO applications 
  (tenant_id, property_id, applicant_email, applicant_name, applicant_phone, 
   monthly_income, employment_info, references, application_status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted')
RETURNING *;

-- Get property landlord for notification
SELECT landlord_id FROM properties WHERE id = $1;
```

---

### CASE 4: Landlord Approves Application

**Endpoint:** `POST /api/applications/{applicationId}/approve`

**Request:**
```json
{
  "unit_id": "uuid-of-unit"
}
```

**Flow:**

```
1. VALIDATE
   ├─ Verify landlord owns the property (via application.property_id)
   ├─ Verify application exists
   └─ Verify application status is 'submitted' or 'under_review'

2. GET APPLICATION DATA
   └─ Query: SELECT * FROM applications WHERE id = applicationId
      ├─ tenant_id: application.tenant_id
      ├─ property_id: application.property_id
      └─ unit_id: provided or NULL

3. CREATE TENANT-PROPERTY LINK
   ├─ Check if link already exists:
   │  Query: SELECT id FROM tenant_property_links 
   │         WHERE tenant_id = $1 AND property_id = $2
   │
   ├─ IF link exists:
   │  └─ UPDATE status = 'active'
   │
   └─ IF link NOT exists:
      └─ INSERT into tenant_property_links:
         ├─ tenant_id: application.tenant_id
         ├─ property_id: application.property_id
         ├─ unit_id: provided unit_id
         ├─ status: 'active' ← Officially connected
         ├─ created_via: 'application_approval'
         ├─ created_by_user_id: landlord_id
         └─ link_start_date: now()

4. UPDATE APPLICATION
   └─ UPDATE applications:
      ├─ application_status: 'approved'
      ├─ reviewed_by_user_id: landlord_id
      └─ review_date: now()

5. NOTIFY TENANT
   ├─ Send notification to tenant
   ├─ "Your application for {property_address} has been approved!"
   └─ Next steps: sign lease or further communication

6. RETURN
   └─ Updated application + tenant_property_links record
```

**SQL Operations:**

```sql
-- Get application
SELECT tenant_id, property_id FROM applications WHERE id = $1;

-- Check existing link
SELECT id, status FROM tenant_property_links 
WHERE tenant_id = $1 AND property_id = $2;

-- Update or create link
INSERT INTO tenant_property_links 
  (tenant_id, property_id, unit_id, status, created_via, created_by_user_id, link_start_date)
VALUES ($1, $2, $3, 'active', 'application_approval', $4, now())
ON CONFLICT (tenant_id, property_id, unit_id, sub_unit_id) 
DO UPDATE SET status = 'active'
RETURNING *;

-- Update application status
UPDATE applications 
SET application_status = 'approved', reviewed_by_user_id = $1, review_date = now()
WHERE id = $2
RETURNING *;
```

---

## 4. EDGE CASES & HANDLING

### Edge Case 1: Duplicate Email, Different User Type
**Scenario:** Email exists as landlord, trying to add as tenant

**Solution:**
```sql
UPDATE users 
SET user_type = 'both' 
WHERE email = $1 AND user_type = 'landlord'
RETURNING id;
```

### Edge Case 2: Re-invite Inactive Tenant
**Scenario:** Tenant was previously linked but link is inactive

**Solution:**
```sql
UPDATE tenant_property_links 
SET status = 'pending_invite', updated_at = now()
WHERE tenant_id = $1 AND property_id = $2 AND status = 'inactive'
RETURNING *;
```

### Edge Case 3: Prevent Duplicate Applications
**Scenario:** Tenant submits multiple applications for same property

**Solution:**
```sql
-- Check constraint via index
CREATE UNIQUE INDEX idx_applications_unique 
ON applications(tenant_id, property_id, application_status) 
WHERE application_status IN ('submitted', 'under_review');

-- Error: "You have an active application for this property"
```

### Edge Case 4: Tenant Removed from Property
**Scenario:** Landlord removes tenant from property (e.g., lease ends)

**Solution:**
```sql
UPDATE tenant_property_links 
SET status = 'inactive', link_end_date = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- Lease can remain as completed historical record
UPDATE leases 
SET status = 'completed' 
WHERE id = $1
RETURNING *;
```

### Edge Case 5: Email Typo Prevention
**Scenario:** Landlord misspells tenant email

**Solution:**
```
1. When creating user with email:
   - Validate email format
   - Check against similar emails in database (fuzzy search optional)
   - Send confirmation email to verify ownership
   
2. For invited tenants:
   - Email invitation to verify
   - Tenant must accept to activate account
   - If no response in 7 days, mark as 'expired_invite'
```

### Edge Case 6: Multiple Properties with Same Tenant
**Scenario:** Tenant linked to multiple properties/units over time

**Solution:**
```sql
-- Query all active links for a tenant
SELECT * FROM tenant_property_links 
WHERE tenant_id = $1 AND status = 'active'
ORDER BY created_at DESC;

-- Each link is tracked separately with unit-level granularity
-- Lease determines which property is "active"
```

### Edge Case 7: Concurrent Lease + Application
**Scenario:** Tenant applies while already having lease elsewhere

**Solution:**
```
Allow multiple applications/leases:
- Can have lease for Property A
- Can apply for Property B simultaneously
- Both tracked separately in leases and applications tables
- No conflict at tenant level (many-to-many relationship)
```

---

## 5. QUERY PATTERNS

### Get All Tenants for a Property
```sql
SELECT u.id, u.email, u.full_name, tpl.status, tpl.link_start_date
FROM tenant_property_links tpl
JOIN users u ON tpl.tenant_id = u.id
WHERE tpl.property_id = $1 AND tpl.status = 'active'
ORDER BY tpl.created_at DESC;
```

### Get All Properties for a Tenant
```sql
SELECT p.id, p.address, p.city, tpl.status, tpl.link_start_date
FROM tenant_property_links tpl
JOIN properties p ON tpl.property_id = p.id
WHERE tpl.tenant_id = $1 AND tpl.status = 'active'
ORDER BY tpl.created_at DESC;
```

### Get Pending Invites
```sql
SELECT tpl.id, u.email, u.full_name, p.address
FROM tenant_property_links tpl
JOIN users u ON tpl.tenant_id = u.id
JOIN properties p ON tpl.property_id = p.id
WHERE tpl.status = 'pending_invite' AND p.landlord_id = $1
ORDER BY tpl.created_at DESC;
```

### Get Lease for Tenant at Property
```sql
SELECT l.* 
FROM leases l
WHERE l.tenant_id = $1 AND l.property_id = $2 AND l.status = 'active'
LIMIT 1;
```

### Get All Applications Pending Review
```sql
SELECT a.*, u.full_name, u.email, p.address
FROM applications a
JOIN users u ON a.tenant_id = u.id
JOIN properties p ON a.property_id = p.id
WHERE p.landlord_id = $1 AND a.application_status = 'submitted'
ORDER BY a.application_date DESC;
```

---

## 6. IMPLEMENTATION SUMMARY

| Case | Trigger | Tenant Link | Lease | Status |
|------|---------|-------------|-------|--------|
| **Case 1** | Landlord adds tenant | `pending_invite` | — | Tenant invited |
| **Case 2** | Lease created | `active` | Created | Ready to sign |
| **Case 3a** | Tenant applies | — | — | Application pending |
| **Case 3b** | Landlord approves | `active` | — | Connected officially |
| **Case 2+3b** | Full flow | Lease → Link | Created | Tenant onboarded |

---

## 7. KEY PRINCIPLES (Enforced)

✅ **Property is the center**: All connections flow through property_id  
✅ **Flexible tenant-landlord**: Connection created via multiple paths (invite, lease, approval)  
✅ **Loose coupling**: Tenant can exist independently of any landlord  
✅ **Traceable**: Every connection has `created_via` and `created_by_user_id`  
✅ **Status tracking**: Link status provides audit trail (active, pending_invite, inactive)  
✅ **No direct user-to-user**: Tenant-landlord relationship always through property  

