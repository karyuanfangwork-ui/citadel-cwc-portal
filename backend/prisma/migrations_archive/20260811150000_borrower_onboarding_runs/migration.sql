CREATE TABLE "borrower_onboarding_runs" (
  "idempotency_key" VARCHAR(160) NOT NULL,
  "user_id" UUID NOT NULL,
  "borrower_id" UUID,
  "status" VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
  "stages" JSONB NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "borrower_onboarding_runs_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "borrower_onboarding_runs_user_id_status_idx"
  ON "borrower_onboarding_runs"("user_id", "status");
