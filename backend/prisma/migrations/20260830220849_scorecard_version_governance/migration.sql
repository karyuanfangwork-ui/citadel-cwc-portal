-- Add creator provenance for scorecard-version maker/checker enforcement.
ALTER TABLE "credit_scorecard_versions"
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credit_scorecard_versions_created_by_id_fkey'
      AND conrelid = 'credit_scorecard_versions'::regclass
  ) THEN
    ALTER TABLE "credit_scorecard_versions"
      ADD CONSTRAINT "credit_scorecard_versions_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "credit_scorecard_versions_created_by_id_idx"
  ON "credit_scorecard_versions"("created_by_id");
