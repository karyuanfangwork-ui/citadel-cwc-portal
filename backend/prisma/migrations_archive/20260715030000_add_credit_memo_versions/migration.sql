-- P2.2: Credit Memo Version — immutable snapshot model
-- Every memo generation creates a versioned snapshot.
-- On committee submission, the latest version is locked.

CREATE TABLE "credit_memo_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL REFERENCES "credit_applications"("id") ON DELETE CASCADE,
    "version_number" INTEGER NOT NULL,
    "html_content" TEXT NOT NULL,
    "pdf_url" VARCHAR(500),
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(6),
    "locked_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "generated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "data_snapshot" JSONB,
    "governance_warnings" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "credit_memo_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_memo_versions_application_id_version_number_key"
    ON "credit_memo_versions"("application_id", "version_number");

CREATE INDEX "credit_memo_versions_application_id_idx"
    ON "credit_memo_versions"("application_id");

CREATE INDEX "credit_memo_versions_is_locked_idx"
    ON "credit_memo_versions"("is_locked");