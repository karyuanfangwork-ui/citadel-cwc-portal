-- P03 Task 12: governed request-attachment lifecycle.

CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_FAILED');
CREATE TYPE "AttachmentClassification" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "AttachmentRetentionStatus" AS ENUM ('ACTIVE', 'LEGAL_HOLD', 'PENDING_DELETION', 'DELETED');

ALTER TABLE "request_attachments"
    ADD COLUMN "tenant_id" UUID,
    ADD COLUMN "department_id" UUID,
    ADD COLUMN "content_hash" VARCHAR(64),
    ADD COLUMN "classification" "AttachmentClassification" NOT NULL DEFAULT 'INTERNAL',
    ADD COLUMN "scan_status" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING_SCAN',
    ADD COLUMN "scan_job_id" UUID,
    ADD COLUMN "scan_callback_nonce_hash" VARCHAR(64),
    ADD COLUMN "scan_callback_expires_at" TIMESTAMP(6),
    ADD COLUMN "scan_callback_consumed_at" TIMESTAMP(6),
    ADD COLUMN "scan_completed_at" TIMESTAMP(6),
    ADD COLUMN "retention_status" "AttachmentRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "retention_until" TIMESTAMP(6),
    ADD COLUMN "legal_hold_at" TIMESTAMP(6);

UPDATE "request_attachments" a
SET "tenant_id" = r."tenant_id",
    "department_id" = r."department_id",
    "classification" = CASE
        WHEN r."is_confidential" THEN 'CONFIDENTIAL'::"AttachmentClassification"
        ELSE 'INTERNAL'::"AttachmentClassification"
    END,
    -- Legacy is_scanned/scan_result rows lack a bound content hash and callback
    -- proof, so they are not trusted as CLEAN until explicitly reconciled.
    "scan_status" = CASE
        WHEN a."is_scanned" THEN 'SCAN_FAILED'::"AttachmentScanStatus"
        ELSE 'PENDING_SCAN'::"AttachmentScanStatus"
    END
FROM "requests" r
WHERE a."request_id" = r."id";

CREATE UNIQUE INDEX "request_attachments_scan_job_id_key"
    ON "request_attachments"("scan_job_id");
CREATE INDEX "request_attachments_tenant_id_department_id_idx"
    ON "request_attachments"("tenant_id", "department_id");
CREATE INDEX "request_attachments_scan_status_idx"
    ON "request_attachments"("scan_status");

ALTER TABLE "request_attachments"
    ADD CONSTRAINT "request_attachments_tenant_department_fkey"
    FOREIGN KEY ("tenant_id", "department_id")
    REFERENCES "departments"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Storage object identity is immutable after registration. Replacements create
-- a new attachment/version instead of retargeting an authorized record.
CREATE OR REPLACE FUNCTION prevent_request_attachment_storage_retarget()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."storage_path" IS DISTINCT FROM OLD."storage_path" THEN
        RAISE EXCEPTION 'request attachment storage_path is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER request_attachment_storage_immutable
BEFORE UPDATE OF "storage_path" ON "request_attachments"
FOR EACH ROW EXECUTE FUNCTION prevent_request_attachment_storage_retarget();

-- Any returned row requires reconciliation before strict non-null ownership can
-- be enforced in the contract stage.
SELECT a."id", a."request_id"
FROM "request_attachments" a
WHERE a."tenant_id" IS NULL OR a."department_id" IS NULL;
