-- Dynamic workflow status catalog and runtime status storage.
-- Existing status values are preserved verbatim; the old PostgreSQL enum is
-- intentionally retained until a later cleanup migration proves it is unused.

CREATE TYPE "RequestStatusLifecycleType" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED', 'CANCELLED');

ALTER TABLE "request_status_definitions"
  ADD COLUMN "lifecycle_type" "RequestStatusLifecycleType" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "retired_at" TIMESTAMP(6);

ALTER TABLE "requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "requests"
  ALTER COLUMN "status" TYPE VARCHAR(100)
  USING "status"::text;
ALTER TABLE "requests" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

CREATE INDEX "request_status_definitions_is_active_category_idx"
  ON "request_status_definitions"("is_active", "category");
CREATE INDEX "request_status_definitions_retired_at_idx"
  ON "request_status_definitions"("retired_at");
