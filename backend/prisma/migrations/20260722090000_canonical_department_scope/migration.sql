-- P02 Task 7 completion: canonical department ownership for desks and requests.
-- Expand/backfill only: nullable legacy rows remain visible in the reconciliation
-- query at the end and must be resolved before a later NOT NULL enforcement.

ALTER TABLE "service_desks" ADD COLUMN IF NOT EXISTS "department_id" UUID;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "department_id" UUID;

-- Every tenant-owned service desk receives a canonical department with the same
-- stable code. This also covers ESM and future metadata-driven desks.
INSERT INTO "departments" (
    "id", "tenant_id", "code", "name", "description", "is_active", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    sd."tenant_id",
    sd."code",
    sd."name",
    sd."description",
    sd."is_active",
    NOW(),
    NOW()
FROM "service_desks" sd
WHERE sd."tenant_id" IS NOT NULL
ON CONFLICT ("tenant_id", "code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = COALESCE("departments"."description", EXCLUDED."description"),
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

UPDATE "service_desks" sd
SET "department_id" = d."id"
FROM "departments" d
WHERE sd."tenant_id" = d."tenant_id"
  AND sd."code" = d."code"
  AND sd."department_id" IS NULL;

UPDATE "requests" r
SET "department_id" = sd."department_id"
FROM "service_desks" sd
WHERE r."service_desk_id" = sd."id"
  AND r."department_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_id_id_key"
    ON "departments"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "service_desks_department_id_idx"
    ON "service_desks"("department_id");
CREATE INDEX IF NOT EXISTS "requests_department_id_idx"
    ON "requests"("department_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'service_desks_tenant_department_fkey'
    ) THEN
        ALTER TABLE "service_desks"
            ADD CONSTRAINT "service_desks_tenant_department_fkey"
            FOREIGN KEY ("tenant_id", "department_id")
            REFERENCES "departments"("tenant_id", "id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'requests_tenant_department_fkey'
    ) THEN
        ALTER TABLE "requests"
            ADD CONSTRAINT "requests_tenant_department_fkey"
            FOREIGN KEY ("tenant_id", "department_id")
            REFERENCES "departments"("tenant_id", "id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Reconciliation query for the migration evidence record. Any returned row is
-- an explicit blocker for the later NOT NULL enforcement stage.
SELECT 'service_desks' AS "resource", COUNT(*) AS "unscoped_count"
FROM "service_desks"
WHERE "tenant_id" IS NULL OR "department_id" IS NULL
UNION ALL
SELECT 'requests' AS "resource", COUNT(*) AS "unscoped_count"
FROM "requests"
WHERE "tenant_id" IS NULL OR "department_id" IS NULL;
