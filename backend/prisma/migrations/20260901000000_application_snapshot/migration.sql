-- CA-P1-001 / GAP-P1-01(a) — record which application used a statement.
ALTER TABLE "financial_statements" ADD COLUMN "application_id" UUID;

ALTER TABLE "financial_statements"
  ADD CONSTRAINT "financial_statements_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "financial_statements_application_id_idx"
  ON "financial_statements"("application_id");

-- CA-P1-003 / GAP-P1-01(c) — immutable decision-context snapshots.
CREATE TYPE "SnapshotType" AS ENUM ('COMMITTEE_SUBMISSION', 'FINAL_DECISION');

CREATE TABLE "application_snapshots" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID          NOT NULL,
  "snapshot_type"  "SnapshotType" NOT NULL,
  "taken_at"       TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taken_by_id"    UUID,
  "payload"        JSONB         NOT NULL,
  "hash"           VARCHAR(64)   NOT NULL,
  "trigger_action" VARCHAR(50)   NOT NULL,
  "created_at"     TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_snapshots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "application_snapshots"
  ADD CONSTRAINT "application_snapshots_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_snapshots"
  ADD CONSTRAINT "application_snapshots_taken_by_id_fkey"
  FOREIGN KEY ("taken_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "application_snapshots_application_id_snapshot_type_idx"
  ON "application_snapshots"("application_id", "snapshot_type");
CREATE INDEX "application_snapshots_taken_at_idx"
  ON "application_snapshots"("taken_at");
CREATE INDEX "application_snapshots_hash_idx"
  ON "application_snapshots"("hash");
