-- CreateTable: application_assessment_results
CREATE TABLE "application_assessment_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "score_run_id" UUID,
  "final_risk_rating" VARCHAR(20),
  "risk_category" VARCHAR(50),
  "decision_recommendation" VARCHAR(20),
  "reason_codes" JSONB,
  "missing_inputs" JSONB,
  "model_version" VARCHAR(50),
  "policy_version" VARCHAR(50),
  "rating_band_version" INTEGER,
  "total_score" DECIMAL(10,2),
  "status" VARCHAR(20) NOT NULL DEFAULT 'FROZEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID,
  "reviewed_by_id" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_assessment_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_assessment_results_application_id_idx" ON "application_assessment_results"("application_id");

ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE;

ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_score_run_id_fkey"
  FOREIGN KEY ("score_run_id") REFERENCES "credit_score_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "application_assessment_results" ADD CONSTRAINT "application_assessment_results_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;