-- P03 Task 12 contract stage: strict attachment ownership and quarantine evidence.

ALTER TABLE "request_attachments"
    ADD COLUMN "quarantine_path" TEXT,
    ADD COLUMN "quarantined_at" TIMESTAMP(6),
    ADD COLUMN "source_deleted_at" TIMESTAMP(6);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "request_attachments"
        WHERE "tenant_id" IS NULL OR "department_id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot enforce attachment ownership: unresolved tenant or department rows remain';
    END IF;
END $$;

ALTER TABLE "request_attachments"
    ALTER COLUMN "tenant_id" SET NOT NULL,
    ALTER COLUMN "department_id" SET NOT NULL;

ALTER TABLE "request_attachments"
    ADD CONSTRAINT "request_attachments_quarantine_evidence_check"
    CHECK (
        ("quarantine_path" IS NULL AND "quarantined_at" IS NULL AND "source_deleted_at" IS NULL)
        OR
        ("scan_status" = 'INFECTED' AND "quarantine_path" IS NOT NULL AND "quarantined_at" IS NOT NULL AND "source_deleted_at" IS NOT NULL)
    );