-- AlterTable: add audit/provenance fields to credit_score_runs
ALTER TABLE "credit_score_runs" ADD COLUMN "calculated_by_id" UUID,
ADD COLUMN "calculation_source" VARCHAR(20),
ADD COLUMN "input_snapshot" JSONB,
ADD COLUMN "policy_version" VARCHAR(50);

-- AlterTable: add score_run_id link on score_override_approvals
ALTER TABLE "score_override_approvals" ADD COLUMN "score_run_id" UUID;

-- CreateIndex / ForeignKey
CREATE UNIQUE INDEX "score_override_approvals_score_run_id_key" ON "score_override_approvals"("score_run_id");

ALTER TABLE "credit_score_runs" ADD CONSTRAINT "credit_score_runs_calculated_by_id_fkey"
  FOREIGN KEY ("calculated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "score_override_approvals" ADD CONSTRAINT "score_override_approvals_score_run_id_fkey"
  FOREIGN KEY ("score_run_id") REFERENCES "credit_score_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;