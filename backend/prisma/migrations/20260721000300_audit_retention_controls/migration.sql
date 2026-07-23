-- Task 20: tamper-evident platform audit chain and retention evidence controls.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "platform_audit_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "department_id" uuid,
    "actor_id" uuid,
    "actor_email" varchar(255),
    "action" varchar(100) NOT NULL,
    "resource_type" varchar(100) NOT NULL,
    "resource_id" uuid,
    "correlation_id" varchar(100),
    "old_value_hash" varchar(64),
    "new_value_hash" varchar(64),
    "metadata" jsonb,
    "hash" varchar(64) NOT NULL,
    "hash_version" integer NOT NULL DEFAULT 1,
    "created_at" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_audit_events_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "platform_audit_events_department_fkey"
      FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_platform_audit_hash_hex" CHECK ("hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "chk_platform_old_hash_hex" CHECK ("old_value_hash" IS NULL OR "old_value_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "chk_platform_new_hash_hex" CHECK ("new_value_hash" IS NULL OR "new_value_hash" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS "platform_audit_events_tenant_created_idx"
  ON "platform_audit_events"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "platform_audit_events_resource_idx"
  ON "platform_audit_events"("tenant_id", "resource_type", "resource_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_audit_events_actor_created_idx"
  ON "platform_audit_events"("actor_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "platform_audit_events_correlation_id_idx"
  ON "platform_audit_events"("correlation_id");

-- Actor identifiers are denormalized immutable evidence. Do not FK actor_id to
-- users: deleting/anonymizing a user must not mutate append-only audit rows.
ALTER TABLE "platform_audit_events" DROP CONSTRAINT IF EXISTS "platform_audit_events_actor_id_fkey";

CREATE OR REPLACE FUNCTION prevent_platform_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_audit_events_append_only ON "platform_audit_events";
CREATE TRIGGER trg_platform_audit_events_append_only
BEFORE UPDATE OR DELETE ON "platform_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_platform_audit_event_mutation();

COMMENT ON TABLE "platform_audit_events" IS 'Append-only hash-chained audit events for platform operations, DLP exports, and retention evidence.';
