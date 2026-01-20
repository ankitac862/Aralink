-- Fix the engine_used constraint to allow all valid values

-- Drop the old constraint
ALTER TABLE lease_documents 
DROP CONSTRAINT IF EXISTS lease_documents_engine_used_check;

-- Add updated constraint with all valid engine types
ALTER TABLE lease_documents 
ADD CONSTRAINT lease_documents_engine_used_check 
CHECK (engine_used IN ('xfa', 'template', 'standard', 'uploaded'));

-- Verify it worked
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'lease_documents_engine_used_check';
