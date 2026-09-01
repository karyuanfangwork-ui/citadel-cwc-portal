-- P03 Task 13: Add governed per-type classification metadata to request types.
-- Replaces hardcoded desk-code-based confidentiality derivation with an explicit
-- classification field that the server owns and the frontend must consume.

-- 1. Create the enum
CREATE TYPE "RequestClassification" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- 2. Add column (nullable for expand/backfill phase)
ALTER TABLE "request_types" ADD COLUMN "classification" "RequestClassification";

-- 3. Backfill: HR and Finance types → CONFIDENTIAL, everything else → INTERNAL
UPDATE "request_types" rt
SET "classification" = 'CONFIDENTIAL'
FROM "service_categories" sc
JOIN "service_desks" sd ON sd.id = sc."service_desk_id"
WHERE rt."service_category_id" = sc.id
  AND sd.code IN ('HR', 'FINANCE');

UPDATE "request_types" rt
SET "classification" = 'INTERNAL'
WHERE rt."classification" IS NULL;

-- 4. Make NOT NULL once backfilled
ALTER TABLE "request_types" ALTER COLUMN "classification" SET NOT NULL;