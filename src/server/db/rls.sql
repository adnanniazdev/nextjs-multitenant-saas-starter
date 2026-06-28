-- ==========================================
-- NEON POSTGRESQL ROW-LEVEL SECURITY POLICY SETUP
-- ==========================================
-- This script enables RLS on tenant-scoped tables and creates isolation policies.
-- Policies match rows where the workspace_id matches the session variable 'app.current_tenant_id'.

-- Enable RLS on Workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_isolation_policy ON workspaces
  USING (
    id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- Enable RLS on Workspace Members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_isolation_policy ON workspace_members
  USING (
    workspace_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- Enable RLS on Invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_isolation_policy ON invitations
  USING (
    workspace_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- Note: The 'users' table is global and is synced directly from Clerk.
-- It does not require RLS as user profiles are shared across tenant memberships.
-- Webhook tracking table ('processed_webhook_events') is also global.
