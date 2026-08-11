CREATE TABLE "crm_lead_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "lead_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "file_size" INTEGER NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "scan_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "scan_completed_at" TIMESTAMP(6),
  "deleted_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_lead_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_lead_documents_lead_id_deleted_at_idx" ON "crm_lead_documents"("lead_id", "deleted_at");
CREATE INDEX "crm_lead_documents_tenant_id_idx" ON "crm_lead_documents"("tenant_id");
CREATE INDEX "crm_lead_documents_uploaded_by_id_idx" ON "crm_lead_documents"("uploaded_by_id");
ALTER TABLE "crm_lead_documents" ADD CONSTRAINT "crm_lead_documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_lead_documents" ADD CONSTRAINT "crm_lead_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;