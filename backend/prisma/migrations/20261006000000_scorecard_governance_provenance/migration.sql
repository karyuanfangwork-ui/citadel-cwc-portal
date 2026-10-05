ALTER TABLE "credit_scorecard_versions"
    ADD COLUMN "effective_to" TIMESTAMP(6),
    ADD COLUMN "activated_by_id" UUID,
    ADD COLUMN "activated_at" TIMESTAMP(6),
    ADD COLUMN "change_reason" TEXT,
    ADD COLUMN "policy_approval_reference" VARCHAR(200),
    ADD COLUMN "market_conditions_acknowledged" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "borrower_risk_runs"
    ADD COLUMN "policy_version" VARCHAR(50);
