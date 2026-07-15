-- P2: Add missing_inputs column to credit_score_runs
-- This column stores the list of factors with missing data and the policy applied (P2.1 governance)

ALTER TABLE "credit_score_runs" ADD COLUMN IF NOT EXISTS "missing_inputs" JSONB;