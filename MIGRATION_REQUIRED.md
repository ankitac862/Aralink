# 🔧 Database Migration Required: Add tenant_id to transactions

## Issue
The accounting page and tenant tracking features require a `tenant_id` column in the transactions table, but it hasn't been added to your Supabase database yet.

**Error Message**:
```
Error fetching tenant transactions: {"code": "42703", "message": "column transactions.tenant_id does not exist"}
```

---

## Solution

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "+ New Query"

### Step 2: Run Migration SQL
Copy and paste the following SQL code and execute it:

```sql
-- Add tenant_id column to transactions table
ALTER TABLE transactions
ADD COLUMN tenant_id UUID;

-- Add foreign key constraint
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
```

### Step 3: Verify
Run this query to confirm the column was added:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;
```

You should see `tenant_id` as a UUID column in the results.

---

## What This Does

| SQL Statement | Purpose |
|---------------|---------|
| `ALTER TABLE ... ADD COLUMN` | Adds the tenant_id column |
| `ADD CONSTRAINT ... FOREIGN KEY` | Ensures data integrity (prevents orphaned records) |
| `ON DELETE SET NULL` | If tenant is deleted, transaction's tenant_id becomes NULL |
| `CREATE INDEX` | Speeds up queries that filter by tenant_id |

---

## After Migration

Once you've run the migration:

1. **Return to VS Code** and run the app again
2. **No code changes needed** - everything is already compatible
3. **Features will work**:
   - ✅ 30-day transaction charts
   - ✅ Tenant profile auto-updates
   - ✅ Tenant-property association queries

---

## Transactions Table Schema (After Migration)

```sql
transactions
├── id (UUID, primary key)
├── user_id (UUID, foreign key to profiles)
├── property_id (UUID, foreign key to properties)
├── unit_id (UUID, foreign key to units)
├── subunit_id (UUID, foreign key to sub_units)
├── tenant_id (UUID, foreign key to tenants) ← NEW
├── lease_id (UUID, foreign key to leases)
├── type (TEXT: 'income' or 'expense')
├── category (TEXT: 'rent', 'garage', etc)
├── amount (DECIMAL)
├── date (DATE)
├── description (TEXT, nullable)
├── service_type (TEXT, nullable)
├── status (TEXT: 'paid', 'pending', 'overdue')
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

Indexes:
├── PRIMARY KEY (id)
├── idx_transactions_user_id
├── idx_transactions_property_id
├── idx_transactions_unit_id
├── idx_transactions_tenant_id ← NEW
└── idx_transactions_date
```

---

## Troubleshooting

### "Column already exists" Error
If you get this error, the column already exists. You're good to go!

### "Foreign key violation" Error
This means the tenants table doesn't exist. Run this first:
```sql
-- Check if tenants table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'tenants'
);
```

If it returns `false`, create it first:
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    property_id UUID,
    unit_id UUID,
    unit_name TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES profiles(id),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);
```

### Query Timeout
If the migration takes too long, it means your transactions table is very large. This is normal. Just wait for it to complete.

---

## Optional: Backfill Existing Tenant Data

If you have existing transactions linked to tenants but don't have tenant_ids populated, you can backfill:

```sql
-- Backfill tenant_id from leases
UPDATE transactions t
SET tenant_id = l.tenant_id
FROM leases l
WHERE t.lease_id = l.id
AND t.tenant_id IS NULL;
```

---

## Related Files

- Migration SQL: `docs/ADD_TENANT_ID_MIGRATION.sql`
- Implementation: `lib/supabase.ts`
- Component: `components/TimeSeriesChart.tsx`
- UI: `app/accounting.tsx`

---

## Next Steps

1. ✅ Run the migration SQL in Supabase
2. ✅ Verify the column was added
3. ✅ Return to VS Code
4. ✅ Run the app again
5. ✅ Features should work now!

---

## Need Help?

Check:
- `QUICK_REFERENCE.md` - Quick answers
- `TRANSACTION_ANALYTICS_GUIDE.md` - Complete guide
- Supabase docs - [PostgreSQL Migrations](https://supabase.com/docs/guides/migrations)

**Status**: After running this migration, all accounting and tenant tracking features will work correctly ✅
