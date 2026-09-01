-- P03 Task 12 hardening: parent-scope integrity and recoverable quarantine evidence.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "request_attachments" attachment
        LEFT JOIN "requests" request
          ON request."id" = attachment."request_id"
         AND request."tenant_id" = attachment."tenant_id"
         AND request."department_id" = attachment."department_id"
        WHERE request."id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot bind attachment ownership: attachment/request scope mismatches remain';
    END IF;
END $$;

CREATE UNIQUE INDEX "requests_id_tenant_id_department_id_key"
    ON "requests"("id", "tenant_id", "department_id");

ALTER TABLE "request_attachments"
    DROP CONSTRAINT "request_attachments_request_id_fkey";

ALTER TABLE "request_attachments"
    ADD CONSTRAINT "request_attachments_request_id_tenant_id_department_id_fkey"
    FOREIGN KEY ("request_id", "tenant_id", "department_id")
    REFERENCES "requests"("id", "tenant_id", "department_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_attachments"
    DROP CONSTRAINT "request_attachments_quarantine_evidence_check";

ALTER TABLE "request_attachments"
    ADD CONSTRAINT "request_attachments_quarantine_evidence_check"
    CHECK (
        ("quarantine_path" IS NULL AND "quarantined_at" IS NULL AND "source_deleted_at" IS NULL)
        OR
        (
            "scan_status" = 'INFECTED'
            AND "quarantine_path" IS NOT NULL
            AND "quarantined_at" IS NOT NULL
        )
    );
