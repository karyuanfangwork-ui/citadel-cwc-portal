-- Workflow-scoped transitions must be able to coexist with global fallback
-- transitions having the same status pair. The composite unique index created by
-- workflow versioning is the authoritative constraint; the legacy pair-only
-- index incorrectly rejects valid scoped rows.
DROP INDEX IF EXISTS "workflow_transitions_from_status_to_status_key";
