-- Add creator/requester attribution for deviation SOD enforcement
ALTER TABLE "deviation_approvals"
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deviation_approvals_created_by_id_fkey'
  ) THEN
    ALTER TABLE "deviation_approvals"
      ADD CONSTRAINT "deviation_approvals_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "deviation_approvals_created_by_id_idx"
  ON "deviation_approvals"("created_by_id");
