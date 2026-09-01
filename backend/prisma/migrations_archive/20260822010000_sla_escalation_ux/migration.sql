-- Add uniqueness for one escalation rule per request type and trigger hour.
CREATE UNIQUE INDEX IF NOT EXISTS "escalation_rules_request_type_id_trigger_hours_after_breach_key"
  ON "escalation_rules"("request_type_id", "trigger_hours_after_breach");

-- Distinguish manual participants from automated escalation recipients.
ALTER TABLE "request_participants"
  ADD COLUMN IF NOT EXISTS "participant_role" VARCHAR(50) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "request_participants"
  ALTER COLUMN "added_by_id" DROP NOT NULL;

DROP INDEX IF EXISTS "request_participants_request_id_user_id_key";
ALTER TABLE "request_participants"
  DROP CONSTRAINT IF EXISTS "request_participants_request_id_user_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "request_participants_request_id_user_id_participant_role_key"
  ON "request_participants"("request_id", "user_id", "participant_role");

CREATE INDEX IF NOT EXISTS "request_participants_request_id_user_id_idx"
  ON "request_participants"("request_id", "user_id");
