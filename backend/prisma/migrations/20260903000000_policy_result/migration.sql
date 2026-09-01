-- CA-P3-008 / GAP-P1-10 — persist the full policy evaluation.
-- Append-only: nothing updates these rows.

CREATE TYPE "PolicyVerdict" AS ENUM ('PASS', 'WARN', 'FAIL');

CREATE TABLE "policy_results" (
  "id"              UUID            NOT NULL,
  "application_id"  UUID            NOT NULL,
  "evaluation_id"   UUID            NOT NULL,
  "rule_code"       VARCHAR(200)    NOT NULL,
  "verdict"         "PolicyVerdict" NOT NULL,
  "source"          VARCHAR(30)     NOT NULL,
  "actual"          VARCHAR(500),
  "threshold"       VARCHAR(500),
  "message"         TEXT            NOT NULL,
  "trigger_action"  VARCHAR(50)     NOT NULL,
  "evaluated_at"    TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluated_by_id" UUID,
  "created_at"      TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_results_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "policy_results"
  ADD CONSTRAINT "policy_results_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "policy_results"
  ADD CONSTRAINT "policy_results_evaluated_by_id_fkey"
  FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "policy_results_application_id_evaluated_at_idx"
  ON "policy_results"("application_id", "evaluated_at");
CREATE INDEX "policy_results_evaluation_id_idx"
  ON "policy_results"("evaluation_id");
CREATE INDEX "policy_results_rule_code_verdict_idx"
  ON "policy_results"("rule_code", "verdict");
