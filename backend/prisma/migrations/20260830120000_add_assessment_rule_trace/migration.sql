-- GAP-P1-05: Preserve the ordered decision rule trace on frozen assessments.
ALTER TABLE "application_assessment_results"
ADD COLUMN IF NOT EXISTS "rule_trace" JSONB;
