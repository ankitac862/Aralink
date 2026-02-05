-- Migration: Add tenant_id column to transactions table
-- Date: 2026-01-19
-- Purpose: Link transactions to tenants for relationship tracking

-- Add tenant_id column to transactions table
ALTER TABLE transactions
ADD COLUMN tenant_id UUID;

-- Add foreign key constraint to tenants table
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id) ON DELETE SET NULL;

-- Create index on tenant_id for faster queries
CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
AND column_name = 'tenant_id';
