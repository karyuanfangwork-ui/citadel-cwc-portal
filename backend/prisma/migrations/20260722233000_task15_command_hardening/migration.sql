-- Task 15 closure: tenant-scoped idempotency, scoped outbox/history,
-- and database-enforced append-only workflow history.

-- 1. Scope immutable history rows to their request tenant/department.
ALTER TABLE "workflow_history"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "department_id" UUID;

UPDATE "workflow_history" AS wh
SET
  "tenant_id" = r."tenant_id",
  "department_id" = r."department_id"
FROM "requests" AS r
WHERE r."id" = wh."request_id";

ALTER TABLE "workflow_history"
  ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "workflow_history"
  DROP CONSTRAINT IF EXISTS "workflow_history_idempotency_key_key";
DROP INDEX IF EXISTS "workflow_history_idempotency_key_key";
CREATE UNIQUE INDEX "workflow_history_tenant_id_idempotency_key_key"
  ON "workflow_history"("tenant_id", "idempotency_key");
CREATE INDEX "workflow_history_tenant_id_created_at_idx"
  ON "workflow_history"("tenant_id", "created_at");
CREATE INDEX "workflow_history_department_id_created_at_idx"
  ON "workflow_history"("department_id", "created_at");

-- Reject direct mutation/deletion. Cascaded deletion from a hard-deleted parent
-- remains possible for retention/test cleanup; normal application deletion is soft.
CREATE OR REPLACE FUNCTION "prevent_workflow_history_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'workflow_history is immutable: updates are prohibited';
  END IF;

  IF TG_OP = 'DELETE' AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'workflow_history is immutable: direct deletes are prohibited';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "workflow_history_immutable" ON "workflow_history";
CREATE TRIGGER "workflow_history_immutable"
BEFORE UPDATE OR DELETE ON "workflow_history"
FOR EACH ROW EXECUTE FUNCTION "prevent_workflow_history_mutation"();

-- 2. Bind every idempotency key to a tenant-scoped command fingerprint.
ALTER TABLE "workflow_command_results"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "department_id" UUID,
  ADD COLUMN "command_hash" CHAR(64);

UPDATE "workflow_command_results" AS wcr
SET
  "tenant_id" = r."tenant_id",
  "department_id" = r."department_id",
  "command_hash" = md5(wcr."id"::text || wcr."idempotency_key") ||
                   md5(wcr."idempotency_key" || wcr."id"::text)
FROM "requests" AS r
WHERE r."id" = wcr."request_id";

ALTER TABLE "workflow_command_results"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ALTER COLUMN "command_hash" SET NOT NULL;

ALTER TABLE "workflow_command_results"
  DROP CONSTRAINT IF EXISTS "workflow_command_results_idempotency_key_key";
DROP INDEX IF EXISTS "workflow_command_results_idempotency_key_key";
DROP INDEX IF EXISTS "workflow_command_results_idempotency_key_idx";
CREATE UNIQUE INDEX "workflow_command_results_tenant_id_idempotency_key_key"
  ON "workflow_command_results"("tenant_id", "idempotency_key");
CREATE INDEX "workflow_command_results_tenant_id_request_id_idx"
  ON "workflow_command_results"("tenant_id", "request_id");
CREATE INDEX "workflow_command_results_department_id_created_at_idx"
  ON "workflow_command_results"("department_id", "created_at");

-- 3. Scope and version outbox events so each transition has one durable event.
ALTER TABLE "outbox_events"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "department_id" UUID,
  ADD COLUMN "aggregate_version" INTEGER;

UPDATE "outbox_events" AS oe
SET
  "tenant_id" = r."tenant_id",
  "department_id" = r."department_id"
FROM "requests" AS r
WHERE oe."aggregate_id" = r."id";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "aggregate_id", "event_type" ORDER BY "created_at", "id") + 1 AS version
  FROM "outbox_events"
)
UPDATE "outbox_events" AS oe
SET "aggregate_version" = ranked.version
FROM ranked
WHERE oe."id" = ranked."id";

ALTER TABLE "outbox_events"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ALTER COLUMN "aggregate_version" SET NOT NULL;

DROP INDEX IF EXISTS "outbox_events_aggregate_id_idx";
CREATE INDEX "outbox_events_tenant_id_published_created_at_idx"
  ON "outbox_events"("tenant_id", "published", "created_at");
CREATE INDEX "outbox_events_department_id_created_at_idx"
  ON "outbox_events"("department_id", "created_at");
CREATE INDEX "outbox_events_aggregate_id_aggregate_version_idx"
  ON "outbox_events"("aggregate_id", "aggregate_version");
CREATE UNIQUE INDEX "outbox_events_tenant_id_event_type_aggregate_id_aggregate_version_key"
  ON "outbox_events"("tenant_id", "event_type", "aggregate_id", "aggregate_version");
