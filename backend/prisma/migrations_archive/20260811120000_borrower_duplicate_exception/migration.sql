CREATE TYPE "DuplicateExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONSUMED', 'EXPIRED');

CREATE TABLE "borrower_duplicate_exceptions" (
  "id" UUID NOT NULL,
  "draft_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "decided_by_id" UUID,
  "matched_borrower_id" UUID NOT NULL,
  "segment" "BorrowerSegment" NOT NULL,
  "identity_fingerprint" VARCHAR(64) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "justification" TEXT NOT NULL,
  "supporting_reference" VARCHAR(255),
  "status" "DuplicateExceptionStatus" NOT NULL DEFAULT 'PENDING',
  "decision_comment" TEXT,
  "expires_at" TIMESTAMP(6),
  "decided_at" TIMESTAMP(6),
  "consumed_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "borrower_duplicate_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "borrower_duplicate_exceptions_requested_by_id_idx" ON "borrower_duplicate_exceptions"("requested_by_id");
CREATE INDEX "borrower_duplicate_exceptions_decided_by_id_idx" ON "borrower_duplicate_exceptions"("decided_by_id");
CREATE INDEX "borrower_duplicate_exceptions_matched_borrower_id_idx" ON "borrower_duplicate_exceptions"("matched_borrower_id");
CREATE INDEX "borrower_duplicate_exceptions_status_idx" ON "borrower_duplicate_exceptions"("status");
CREATE INDEX "borrower_duplicate_exceptions_expires_at_idx" ON "borrower_duplicate_exceptions"("expires_at");
CREATE INDEX "borrower_duplicate_exceptions_identity_fingerprint_idx" ON "borrower_duplicate_exceptions"("identity_fingerprint");

ALTER TABLE "borrower_duplicate_exceptions" ADD CONSTRAINT "borrower_duplicate_exceptions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrower_duplicate_exceptions" ADD CONSTRAINT "borrower_duplicate_exceptions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "borrower_duplicate_exceptions" ADD CONSTRAINT "borrower_duplicate_exceptions_matched_borrower_id_fkey" FOREIGN KEY ("matched_borrower_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
