-- Allow users to view leases if their email matches the application email or tenant_invitations email
CREATE OR REPLACE VIEW user_emails AS
  SELECT email FROM auth.users WHERE id = auth.uid();

-- WAIT, auth.jwt() ->> 'email' is better

DROP POLICY IF EXISTS "Applicants can view leases by email" ON leases;
CREATE POLICY "Applicants can view leases by email"
ON leases FOR SELECT
USING (
  application_id IN (
    SELECT id FROM applications
    WHERE applicant_email = (auth.jwt() ->> 'email') OR user_id = auth.uid()
  )
  OR
  id IN (
    SELECT lease_id FROM tenant_invitations
    WHERE email = (auth.jwt() ->> 'email')
  )
);
