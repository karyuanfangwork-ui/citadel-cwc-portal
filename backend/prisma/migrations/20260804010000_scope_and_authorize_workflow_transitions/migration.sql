-- Migration: scope_and_authorize_workflow_transitions
-- Adds tenantId, workflowTypeId, allowedRoles, allowedExecutiveRoles to WorkflowTransition
-- Changes unique constraint from (fromStatus, toStatus) to (tenantId, workflowTypeId, fromStatus, toStatus)
-- NULL on tenantId/workflowTypeId means "applies to all" — preserves existing rows as global defaults.

BEGIN;

-- Add new columns with safe defaults
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS workflow_type_id UUID;
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE workflow_transitions ADD COLUMN IF NOT EXISTS allowed_executive_roles TEXT[] NOT NULL DEFAULT '{}';

-- Drop the old unique constraint and create the new one
ALTER TABLE workflow_transitions DROP CONSTRAINT IF EXISTS workflow_transitions_from_status_to_status_key;
ALTER TABLE workflow_transitions ADD CONSTRAINT workflow_transitions_tenant_id_workflow_type_id_from_status_to_status_key UNIQUE (tenant_id, workflow_type_id, from_status, to_status);

-- Add the composite index
CREATE INDEX IF NOT EXISTS workflow_transitions_tenant_id_workflow_type_id_from_status_idx ON workflow_transitions (tenant_id, workflow_type_id, from_status);

COMMIT;