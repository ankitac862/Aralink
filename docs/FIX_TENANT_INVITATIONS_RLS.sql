-- Drop the policy that causes the permission error
DROP POLICY IF EXISTS "Users can view their own invitations" ON tenant_invitations;

-- Create the secure version that checks the JWT directly
CREATE POLICY "Users can view their own invitations"
  ON tenant_invitations
  FOR SELECT
  USING (
    email = (auth.jwt() ->> 'email')
  );
