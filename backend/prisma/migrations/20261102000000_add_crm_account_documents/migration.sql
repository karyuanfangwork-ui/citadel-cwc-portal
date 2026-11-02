CREATE TABLE "crm_account_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "account_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "crm_account_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_account_documents_account_id_deleted_at_idx" ON "crm_account_documents"("account_id", "deleted_at");
CREATE INDEX "crm_account_documents_account_id_content_hash_idx" ON "crm_account_documents"("account_id", "content_hash");
CREATE INDEX "crm_account_documents_tenant_id_idx" ON "crm_account_documents"("tenant_id");
CREATE INDEX "crm_account_documents_uploaded_by_id_idx" ON "crm_account_documents"("uploaded_by_id");

ALTER TABLE "crm_account_documents" ADD CONSTRAINT "crm_account_documents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_account_documents" ADD CONSTRAINT "crm_account_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
