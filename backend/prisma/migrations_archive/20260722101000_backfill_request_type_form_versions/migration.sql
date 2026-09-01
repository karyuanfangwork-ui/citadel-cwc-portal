-- P03 Task 13: every submitted request binds to an explicit published form version.
UPDATE "request_types"
SET "form_config_version" = 1
WHERE "form_config_version" IS NULL;

ALTER TABLE "request_types"
    ALTER COLUMN "form_config_version" SET DEFAULT 1;
