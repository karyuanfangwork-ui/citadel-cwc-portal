-- P2.1: Add ScoreFactorDefinition model and scoreRunWarnings field to CreditScoreRun
-- ScoreFactorDefinition replaces hardcoded factor groups with database-driven definitions
-- that support activation/deactivation, effective dates, and input source type tracking.

CREATE TABLE "score_factor_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factor_key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "input_source_type" VARCHAR(20) NOT NULL,
    "applicable_borrower_types" VARCHAR(200) NOT NULL DEFAULT 'INDIVIDUAL,SOLE_PROPRIETOR,CORPORATE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "effective_to" TIMESTAMP(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "score_factor_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "score_factor_definitions_factor_key_key" ON "score_factor_definitions"("factor_key");
CREATE INDEX "score_factor_definitions_factor_key_idx" ON "score_factor_definitions"("factor_key");
CREATE INDEX "score_factor_definitions_active_effective_idx" ON "score_factor_definitions"("is_active", "effective_from", "effective_to");

-- Add scoreRunWarnings column to credit_score_runs
ALTER TABLE "credit_score_runs" ADD COLUMN "score_run_warnings" JSONB;