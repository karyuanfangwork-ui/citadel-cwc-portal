-- G-09: Canonical denormalised application risk rating.
ALTER TABLE "credit_applications"
  ADD COLUMN IF NOT EXISTS "risk_rating" "RiskRating",
  ADD COLUMN IF NOT EXISTS "risk_rating_updated_at" TIMESTAMP(6);

-- Backfill from the latest score run per application.
WITH latest_score AS (
  SELECT DISTINCT ON ("application_id")
    "application_id",
    "risk_rating",
    "run_at"
  FROM "credit_score_runs"
  ORDER BY "application_id", "run_at" DESC, "created_at" DESC
)
UPDATE "credit_applications" ca
SET
  "risk_rating" = latest_score."risk_rating",
  "risk_rating_updated_at" = latest_score."run_at"
FROM latest_score
WHERE ca."id" = latest_score."application_id"
  AND ca."risk_rating" IS NULL;

CREATE INDEX IF NOT EXISTS "credit_applications_risk_rating_idx"
  ON "credit_applications"("risk_rating");
