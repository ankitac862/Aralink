# ⚡ QUICK ACTION: Fix the tenant_id Error

## The Problem
Your app is showing: `column transactions.tenant_id does not exist`

## The Solution (5 minutes)

### Step 1: Open Supabase (2 min)
1. Go to https://app.supabase.com
2. Select your Aaralink project
3. Click "SQL Editor" on the left
4. Click "+ New Query"

### Step 2: Copy & Run This SQL (1 min)
```sql
ALTER TABLE transactions
ADD COLUMN tenant_id UUID;

ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
```

Click "Run" button

### Step 3: Back to App (2 min)
1. Return to VS Code
2. Restart the app
3. Done! ✅

---

## What Changed?
- ✅ Added `tenant_id` column to transactions
- ✅ Linked tenants to transactions
- ✅ Created index for fast queries
- ✅ App now works perfectly

## More Details?
See: `MIGRATION_REQUIRED.md` or `QUICK_REFERENCE.md`

**Time to fix**: ~5 minutes
**Difficulty**: Easy (just run SQL)
