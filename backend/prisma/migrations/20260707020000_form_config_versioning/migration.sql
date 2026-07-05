-- P5-04: Form config versioning
-- Adds formConfigVersion to RequestType (tracks form version) and
-- formConfigSnapshot + formConfigVersion to Request (preserves form at submission time).

-- Add version counter to request_types
ALTER TABLE "request_types" ADD COLUMN "form_config_version" INTEGER;

-- Set existing request types to version 1
UPDATE "request_types" SET "form_config_version" = 1 WHERE "form_config" IS NOT NULL;

-- Add snapshot and version to requests
ALTER TABLE "requests" ADD COLUMN "form_config_snapshot" JSONB;
ALTER TABLE "requests" ADD COLUMN "form_config_version" INTEGER;

-- Backfill: snapshot current form config for existing requests that have custom_fields
UPDATE "requests" r
SET
  "form_config_snapshot" = rt."form_config",
  "form_config_version" = rt."form_config_version"
FROM "request_types" rt
WHERE r."request_type_id" = rt."id"
  AND r."custom_fields" IS NOT NULL;