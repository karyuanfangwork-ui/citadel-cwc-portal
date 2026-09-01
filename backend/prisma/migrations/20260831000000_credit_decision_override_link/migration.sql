-- GAP-P1-02 / CA-P4-001 — link credit decisions to the assessment they were
-- taken against, and record overrides of the system recommendation.
ALTER TABLE "credit_decisions"
  ADD COLUMN "assessment_result_id"  UUID,
  ADD COLUMN "system_recommendation" VARCHAR(20),
  ADD COLUMN "is_override"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "override_reason"       TEXT,
  ADD COLUMN "approved_amount"       DECIMAL(15,2),
  ADD COLUMN "approved_tenor"        INTEGER;

ALTER TABLE "credit_decisions"
  ADD CONSTRAINT "credit_decisions_assessment_result_id_fkey"
  FOREIGN KEY ("assessment_result_id")
  REFERENCES "application_assessment_results"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "credit_decisions_is_override_idx" ON "credit_decisions"("is_override");
CREATE INDEX "credit_decisions_assessment_result_id_idx" ON "credit_decisions"("assessment_result_id");
