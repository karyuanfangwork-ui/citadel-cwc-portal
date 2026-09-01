-- Backfill the first data-driven authorization rules for executive approval gates.
-- Empty allow-lists remain the compatibility default for non-approval transitions.
UPDATE workflow_transitions
SET allowed_roles = CASE
      WHEN from_status LIKE 'PENDING_CEO%' THEN ARRAY['CEO']::TEXT[]
      WHEN from_status LIKE 'PENDING_GROUP_DCEO%' THEN ARRAY['GROUP_DCEO']::TEXT[]
      WHEN from_status LIKE 'PENDING_CFO%' THEN ARRAY['CFO']::TEXT[]
      WHEN from_status LIKE 'PENDING_CTO%' THEN ARRAY['CTO']::TEXT[]
      ELSE allowed_roles
    END,
    allowed_executive_roles = CASE
      WHEN from_status LIKE 'PENDING_CEO%' THEN ARRAY['CEO']::TEXT[]
      WHEN from_status LIKE 'PENDING_GROUP_DCEO%' THEN ARRAY['GROUP_DCEO']::TEXT[]
      WHEN from_status LIKE 'PENDING_CFO%' THEN ARRAY['CFO']::TEXT[]
      WHEN from_status LIKE 'PENDING_CTO%' THEN ARRAY['CTO']::TEXT[]
      ELSE allowed_executive_roles
    END
WHERE cardinality(allowed_roles) = 0
  AND cardinality(allowed_executive_roles) = 0
  AND (
    from_status LIKE 'PENDING_CEO%'
    OR from_status LIKE 'PENDING_GROUP_DCEO%'
    OR from_status LIKE 'PENDING_CFO%'
    OR from_status LIKE 'PENDING_CTO%'
  );

-- Workflow history is append-only. Parent request deletion may still remove history
-- through the existing foreign-key cascade; direct edits and deletes are forbidden.
CREATE OR REPLACE FUNCTION prevent_workflow_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'workflow history is immutable';
END;
$$;

DROP TRIGGER IF EXISTS workflow_history_immutable ON workflow_history;
CREATE TRIGGER workflow_history_immutable
BEFORE UPDATE ON workflow_history
FOR EACH ROW
EXECUTE FUNCTION prevent_workflow_history_mutation();
